import type { Print } from "../types/Print";
import { db } from "../database/db";
import { supabase } from "../lib/supabase";

type CloudPrint = {
  id: string;
  client_key: string;
  data: Omit<Print, "id" | "cloudId" | "bronBestand">;
};

function cloudData(print: Print): CloudPrint["data"] {
  return Object.fromEntries(
    Object.entries(print).filter(([key]) => !["id", "cloudId", "bronBestand"].includes(key))
  ) as CloudPrint["data"];
}

async function currentUserId() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function syncPrints() {
  const userId = await currentUserId();
  if (!supabase || !userId) return;

  const localPrintIds = await db.prints.toCollection().primaryKeys();
  for (const id of localPrintIds) {
    const print = await db.prints.get(id);
    if (!print || print.cloudId) continue;
    const syncKey = print.syncKey || crypto.randomUUID();
    if (!print.syncKey) await db.prints.update(print.id!, { syncKey });
    const prepared = { ...print, syncKey };
    const { data, error } = await supabase
      .from("prints")
      .upsert({ user_id: userId, client_key: syncKey, data: cloudData(prepared) }, { onConflict: "user_id,client_key" })
      .select("id")
      .single();
    if (error) throw error;
    await db.prints.update(print.id!, { cloudId: data.id });
  }

  const { data: remotePrints, error } = await supabase
    .from("prints")
    .select("id,client_key,data")
    .order("created_at", { ascending: true });
  if (error) throw error;

  for (const remote of (remotePrints ?? []) as CloudPrint[]) {
    const local = await db.prints.where("cloudId").equals(remote.id).first();
    if (local) await db.prints.update(local.id!, { ...remote.data, cloudId: remote.id });
    else await db.prints.add({ ...remote.data, syncKey: remote.client_key, cloudId: remote.id } as Print);
  }
}

export async function uploadPrint(print: Print) {
  const userId = await currentUserId();
  if (!supabase || !userId) return;

  if (print.cloudId) {
    const { error } = await supabase
      .from("prints")
      .update({ data: cloudData(print), updated_at: new Date().toISOString() })
      .eq("id", print.cloudId);
    if (error) throw error;
    return;
  }

  const syncKey = print.syncKey || crypto.randomUUID();
  if (!print.syncKey) await db.prints.update(print.id!, { syncKey });
  const prepared = { ...print, syncKey };
  const { data, error } = await supabase
    .from("prints")
    .upsert({ user_id: userId, client_key: syncKey, data: cloudData(prepared) }, { onConflict: "user_id,client_key" })
    .select("id")
    .single();
  if (error) throw error;
  await db.prints.update(print.id!, { cloudId: data.id, syncKey });
}

export async function deleteCloudPrint(cloudId?: string) {
  if (!supabase || !cloudId) return;
  const { error } = await supabase.from("prints").delete().eq("id", cloudId);
  if (error) throw error;
}
