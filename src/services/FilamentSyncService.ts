import { db } from "../database/db";
import { supabase } from "../lib/supabase";
import type { Filament } from "../types/Filament";
import { filamentKey } from "../utils/filamentIdentity";

type CloudFilament = {
  id: string;
  client_key: string;
  data: Omit<Filament, "id" | "cloudId">;
};

function cloudData(filament: Filament): CloudFilament["data"] {
  return Object.fromEntries(
    Object.entries(filament).filter(([key]) => !["id", "cloudId", "syncPending"].includes(key)),
  ) as CloudFilament["data"];
}

async function currentUserId() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function syncFilaments() {
  const userId = await currentUserId();
  if (!supabase || !userId) return;

  const deletions = await db.syncDeletions.where("entity").equals("filament").toArray();
  for (const deletion of deletions) {
    if (deletion.userId && deletion.userId !== userId) continue;
    const { error } = await supabase.from("filaments").delete().eq("id", deletion.cloudId);
    if (error) throw error;
    await db.syncDeletions.delete(deletion.key);
  }

  const { data: existingRemote, error: existingError } = await supabase
    .from("filaments")
    .select("id,client_key,data")
    .order("created_at", { ascending: true });
  if (existingError) throw existingError;

  const remoteByFingerprint = new Map(
    ((existingRemote ?? []) as CloudFilament[]).map((remote) => [filamentKey(remote.data as Filament), remote]),
  );
  const claimedCloudIds = new Set((await db.filamenten.toArray()).flatMap((item) => item.cloudId ? [item.cloudId] : []));
  for (const local of (await db.filamenten.toArray()).filter((item) => !item.cloudId)) {
    const matching = remoteByFingerprint.get(filamentKey(local));
    if (!matching) continue;
    if (claimedCloudIds.has(matching.id)) {
      await db.filamenten.delete(local.id!);
      continue;
    }
    await db.filamenten.update(local.id!, { ...matching.data, cloudId: matching.id, syncKey: matching.client_key, syncPending: false });
    claimedCloudIds.add(matching.id);
  }

  const localFilaments = await db.filamenten.toArray();
  for (const filament of localFilaments.filter((item) => !item.cloudId || item.syncPending)) {
    if (filament.cloudId) {
      const { error } = await supabase
        .from("filaments")
        .update({ data: cloudData(filament), updated_at: new Date().toISOString() })
        .eq("id", filament.cloudId);
      if (error) throw error;
      await db.filamenten.update(filament.id!, { syncPending: false });
      continue;
    }
    const syncKey = filament.syncKey || crypto.randomUUID();
    const prepared = { ...filament, syncKey };
    if (!filament.syncKey) await db.filamenten.update(filament.id!, { syncKey });
    const { data, error } = await supabase
      .from("filaments")
      .upsert({ user_id: userId, client_key: syncKey, data: cloudData(prepared) }, { onConflict: "user_id,client_key" })
      .select("id")
      .single();
    if (error) throw error;
    await db.filamenten.update(filament.id!, { cloudId: data.id, syncKey, syncPending: false });
  }

  const { data: remoteFilaments, error } = await supabase
    .from("filaments")
    .select("id,client_key,data")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const remoteIds = new Set((remoteFilaments ?? []).map((remote) => remote.id));
  for (const local of (await db.filamenten.toArray()).filter((item) => item.cloudId && !remoteIds.has(item.cloudId))) {
    await db.filamenten.delete(local.id!);
  }

  for (const remote of (remoteFilaments ?? []) as CloudFilament[]) {
    const local = await db.filamenten.where("cloudId").equals(remote.id).first();
    if (local) await db.filamenten.update(local.id!, { ...remote.data, cloudId: remote.id, syncKey: remote.client_key });
    else await db.filamenten.add({ ...remote.data, syncKey: remote.client_key, cloudId: remote.id } as Filament);
  }
}

export async function uploadFilament(filament: Filament) {
  const userId = await currentUserId();
  if (!supabase || !userId) return;

  if (filament.cloudId) {
    const { error } = await supabase
      .from("filaments")
      .update({ data: cloudData(filament), updated_at: new Date().toISOString() })
      .eq("id", filament.cloudId);
    if (error) throw error;
    await db.filamenten.update(filament.id!, { syncPending: false });
    return;
  }

  const syncKey = filament.syncKey || crypto.randomUUID();
  const prepared = { ...filament, syncKey };
  const { data, error } = await supabase
    .from("filaments")
    .upsert({ user_id: userId, client_key: syncKey, data: cloudData(prepared) }, { onConflict: "user_id,client_key" })
    .select("id")
    .single();
  if (error) throw error;
  await db.filamenten.update(filament.id!, { cloudId: data.id, syncKey, syncPending: false });
}

export async function deleteCloudFilament(cloudId?: string) {
  if (!supabase || !cloudId) return;
  const { error } = await supabase.from("filaments").delete().eq("id", cloudId);
  if (error) throw error;
}

export async function queueCloudFilamentDeletion(cloudId: string) {
  const userId = await currentUserId();
  await db.syncDeletions.put({ key: `filament:${cloudId}`, entity: "filament", cloudId, userId: userId ?? undefined });
}
