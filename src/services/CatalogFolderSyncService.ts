import { db } from "../database/db";
import { supabase } from "../lib/supabase";
import type { CatalogFolder } from "../types/CatalogFolder";

type CloudCatalogFolder = {
  id: string;
  client_key: string;
  data: Omit<CatalogFolder, "id" | "cloudId" | "syncPending" | "parentId">;
};

function cloudData(folder: CatalogFolder): CloudCatalogFolder["data"] {
  return Object.fromEntries(
    Object.entries(folder).filter(([key]) => !["id", "cloudId", "syncKey", "syncPending", "parentId"].includes(key)),
  ) as CloudCatalogFolder["data"];
}

async function currentUserId() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function withParentCloudId(folder: CatalogFolder) {
  if (folder.parentId === null || folder.parentId === undefined) return { ...folder, parentCloudId: null };
  const parent = await db.folders.get(folder.parentId);
  if (!parent) return { ...folder, parentId: null, parentCloudId: null };
  return parent.cloudId ? { ...folder, parentCloudId: parent.cloudId } : folder;
}

async function localData(remote: CloudCatalogFolder) {
  const values = { ...remote.data } as CatalogFolder;
  if (values.parentCloudId) {
    const parent = await db.folders.where("cloudId").equals(values.parentCloudId).first();
    values.parentId = parent?.id ?? null;
  } else {
    values.parentId = null;
  }
  return values;
}

function depth(folder: CatalogFolder, byId: Map<number, CatalogFolder>) {
  const visited = new Set<number>();
  let current: CatalogFolder | undefined = folder;
  let level = 0;

  while (current?.parentId !== null && current?.parentId !== undefined && !visited.has(current.parentId)) {
    visited.add(current.parentId);
    current = byId.get(current.parentId);
    if (!current) break;
    level += 1;
  }

  return level;
}

async function resolveParentLinks() {
  const folders = await db.folders.toArray();
  for (const folder of folders) {
    if (folder.id === undefined || !folder.parentCloudId) continue;
    const parent = await db.folders.where("cloudId").equals(folder.parentCloudId).first();
    const parentId = parent?.id ?? null;
    if ((folder.parentId ?? null) !== parentId) await db.folders.update(folder.id, { parentId });
  }
}

export async function syncCatalogFolders() {
  const userId = await currentUserId();
  if (!supabase || !userId) return;

  const deletions = await db.syncDeletions.where("entity").equals("folder").toArray();
  for (const deletion of deletions) {
    if (deletion.userId && deletion.userId !== userId) continue;
    const { error } = await supabase.from("catalog_folders").delete().eq("id", deletion.cloudId);
    if (error) throw error;
    await db.syncDeletions.delete(deletion.key);
  }

  const allLocal = await db.folders.toArray();
  const byId = new Map(allLocal.filter((folder) => folder.id !== undefined).map((folder) => [folder.id!, folder]));
  const pendingFolders = allLocal
    .filter((folder) => !folder.cloudId || folder.syncPending)
    .sort((a, b) => depth(a, byId) - depth(b, byId));

  for (const original of pendingFolders) {
    if (original.id === undefined) continue;
    const folder = await withParentCloudId(original);
    if (folder.parentId !== original.parentId || folder.parentCloudId !== original.parentCloudId) {
      await db.folders.update(original.id, { parentId: folder.parentId, parentCloudId: folder.parentCloudId });
    }

    if (folder.parentId !== null && folder.parentId !== undefined && !folder.parentCloudId) continue;

    if (folder.cloudId) {
      const { error } = await supabase
        .from("catalog_folders")
        .update({ data: cloudData(folder), updated_at: new Date().toISOString() })
        .eq("id", folder.cloudId);
      if (error) throw error;
      await db.folders.update(original.id, { parentCloudId: folder.parentCloudId ?? null, syncPending: false });
      continue;
    }

    const syncKey = folder.syncKey || crypto.randomUUID();
    const prepared = { ...folder, syncKey };
    if (!folder.syncKey) await db.folders.update(original.id, { syncKey });
    const { data, error } = await supabase
      .from("catalog_folders")
      .upsert({ user_id: userId, client_key: syncKey, data: cloudData(prepared) }, { onConflict: "user_id,client_key" })
      .select("id")
      .single();
    if (error) throw error;
    await db.folders.update(original.id, { cloudId: data.id, syncKey, parentCloudId: folder.parentCloudId ?? null, syncPending: false });
  }

  const { data: remoteFolders, error } = await supabase
    .from("catalog_folders")
    .select("id,client_key,data")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const remoteIds = new Set((remoteFolders ?? []).map((remote) => remote.id));
  for (const local of (await db.folders.toArray()).filter((folder) => folder.cloudId && !remoteIds.has(folder.cloudId))) {
    await db.folders.delete(local.id!);
  }

  for (const remote of (remoteFolders ?? []) as CloudCatalogFolder[]) {
    const values = await localData(remote);
    const local = await db.folders.where("cloudId").equals(remote.id).first();
    const synced = { ...values, cloudId: remote.id, syncKey: remote.client_key, syncPending: false };
    if (local) await db.folders.update(local.id!, synced);
    else await db.folders.add(synced as CatalogFolder);
  }

  await resolveParentLinks();
}

export async function uploadCatalogFolder(folder: CatalogFolder) {
  if (folder.id === undefined) return;
  await db.folders.update(folder.id, { syncPending: true });
  await syncCatalogFolders();
}

export async function queueCloudFolderDeletion(cloudId: string) {
  const userId = await currentUserId();
  await db.syncDeletions.put({ key: `folder:${cloudId}`, entity: "folder", cloudId, userId: userId ?? undefined });
}
