import { db } from "../database/db";
import type { Inventory } from "../types/Inventory";
import { queueCloudInventoryDeletion, syncInventory, uploadInventory } from "./InventorySyncService";

async function uploadLater(item: Inventory | undefined) {
  if (!item) return;
  try { await uploadInventory(item); } catch (error) { console.warn("Inventarissync uitgesteld:", error); }
}

export async function loadInventory() {
  try { await syncInventory(); } catch (error) { console.warn("Inventarissync uitgesteld:", error); }
  return db.inventory.toArray();
}

export async function createInventory(item: Omit<Inventory, "id" | "cloudId" | "syncKey" | "syncPending">) {
  const id = await db.inventory.add({ ...item, syncPending: true });
  await uploadLater(await db.inventory.get(id));
  return id;
}

export async function updateInventory(id: number, changes: Partial<Inventory>) {
  await db.inventory.update(id, { ...changes, syncPending: true });
  await uploadLater(await db.inventory.get(id));
}

export async function deleteInventory(id: number) {
  const item = await db.inventory.get(id);
  if (item?.cloudId) await queueCloudInventoryDeletion(item.cloudId);
  await db.inventory.delete(id);
  try { await syncInventory(); } catch (error) { console.warn("Inventarisverwijdering uitgesteld:", error); }
}
