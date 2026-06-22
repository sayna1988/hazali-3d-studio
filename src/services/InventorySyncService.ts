import { db } from "../database/db";
import { supabase } from "../lib/supabase";
import type { Inventory } from "../types/Inventory";

type CloudInventory = {
  id: string;
  client_key: string;
  data: Omit<Inventory, "id" | "cloudId" | "syncPending">;
};

function cloudData(item: Inventory): CloudInventory["data"] {
  return Object.fromEntries(
    Object.entries(item).filter(([key]) => !["id", "cloudId", "syncPending", "printId"].includes(key)),
  ) as CloudInventory["data"];
}

async function currentUserId() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function addPrintLink(item: Inventory) {
  if (!item.printId || item.printCloudId) return item;
  const print = await db.prints.get(item.printId);
  return print?.cloudId ? { ...item, printCloudId: print.cloudId } : item;
}

async function localData(remote: CloudInventory) {
  const data = { ...remote.data } as Inventory;
  if (data.printCloudId) {
    const print = await db.prints.where("cloudId").equals(data.printCloudId).first();
    data.printId = print?.id;
  }
  return data;
}

export async function syncInventory() {
  const userId = await currentUserId();
  if (!supabase || !userId) return;

  const deletions = await db.syncDeletions.where("entity").equals("inventory").toArray();
  for (const deletion of deletions) {
    if (deletion.userId && deletion.userId !== userId) continue;
    const { error } = await supabase.from("inventory").delete().eq("id", deletion.cloudId);
    if (error) throw error;
    await db.syncDeletions.delete(deletion.key);
  }

  const localItems = await db.inventory.toArray();
  for (const original of localItems.filter((item) => !item.cloudId || item.syncPending)) {
    const item = await addPrintLink(original);
    if (item.printCloudId !== original.printCloudId) {
      await db.inventory.update(item.id!, { printCloudId: item.printCloudId });
    }

    if (item.cloudId) {
      const { error } = await supabase
        .from("inventory")
        .update({ data: cloudData(item), updated_at: new Date().toISOString() })
        .eq("id", item.cloudId);
      if (error) throw error;
      await db.inventory.update(item.id!, { syncPending: false });
      continue;
    }

    const syncKey = item.syncKey || crypto.randomUUID();
    if (!item.syncKey) await db.inventory.update(item.id!, { syncKey });
    const { data, error } = await supabase
      .from("inventory")
      .upsert({ user_id: userId, client_key: syncKey, data: cloudData({ ...item, syncKey }) }, { onConflict: "user_id,client_key" })
      .select("id")
      .single();
    if (error) throw error;
    await db.inventory.update(item.id!, { cloudId: data.id, syncKey, syncPending: false });
  }

  const { data: remoteItems, error } = await supabase
    .from("inventory")
    .select("id,client_key,data")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const remoteIds = new Set((remoteItems ?? []).map((remote) => remote.id));
  for (const local of (await db.inventory.toArray()).filter((item) => item.cloudId && !remoteIds.has(item.cloudId))) {
    await db.inventory.delete(local.id!);
  }

  for (const remote of (remoteItems ?? []) as CloudInventory[]) {
    const values = await localData(remote);
    const local = await db.inventory.where("cloudId").equals(remote.id).first();
    const synced = { ...values, cloudId: remote.id, syncKey: remote.client_key, syncPending: false };
    if (local) await db.inventory.update(local.id!, synced);
    else await db.inventory.add(synced as Inventory);
  }
}

export async function uploadInventory(item: Inventory) {
  const userId = await currentUserId();
  if (!supabase || !userId) return;
  const prepared = await addPrintLink(item);

  if (prepared.cloudId) {
    const { error } = await supabase
      .from("inventory")
      .update({ data: cloudData(prepared), updated_at: new Date().toISOString() })
      .eq("id", prepared.cloudId);
    if (error) throw error;
    await db.inventory.update(prepared.id!, { printCloudId: prepared.printCloudId, syncPending: false });
    return;
  }

  const syncKey = prepared.syncKey || crypto.randomUUID();
  const { data, error } = await supabase
    .from("inventory")
    .upsert({ user_id: userId, client_key: syncKey, data: cloudData({ ...prepared, syncKey }) }, { onConflict: "user_id,client_key" })
    .select("id")
    .single();
  if (error) throw error;
  await db.inventory.update(prepared.id!, { cloudId: data.id, syncKey, printCloudId: prepared.printCloudId, syncPending: false });
}

export async function queueCloudInventoryDeletion(cloudId: string) {
  const userId = await currentUserId();
  await db.syncDeletions.put({ key: `inventory:${cloudId}`, entity: "inventory", cloudId, userId: userId ?? undefined });
}
