import { db } from "../database/db";
import type { Filament } from "../types/Filament";
import { deleteCloudFilament, syncFilaments, uploadFilament } from "./FilamentSyncService";

export async function loadFilaments() {
  try { await syncFilaments(); } catch (error) { console.warn("Filamentsync uitgesteld:", error); }
  return db.filamenten.toArray();
}

export async function createFilament(filament: Omit<Filament, "id" | "cloudId" | "syncKey">) {
  const id = await db.filamenten.add(filament);
  const saved = await db.filamenten.get(id);
  if (saved) {
    try { await uploadFilament(saved); } catch (error) { console.warn("Filamentupload uitgesteld:", error); }
  }
  return id;
}

export async function updateFilament(id: number, changes: Partial<Filament>) {
  await db.filamenten.update(id, { ...changes, syncPending: true });
  const saved = await db.filamenten.get(id);
  if (saved) {
    try { await uploadFilament(saved); } catch (error) { console.warn("Filamentupload uitgesteld:", error); }
  }
}

export async function deleteFilament(id: number) {
  const filament = await db.filamenten.get(id);
  await deleteCloudFilament(filament?.cloudId);
  await db.filamenten.delete(id);
}
