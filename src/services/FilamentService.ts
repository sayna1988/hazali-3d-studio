import { db } from "../database/db";
import type { Filament } from "../types/Filament";
import { deleteCloudFilament, syncFilaments, uploadFilament } from "./FilamentSyncService";
import { filamentKey } from "../utils/filamentIdentity";
import { rolGegevens } from "../utils/filamentInventory";

function combinedValues(filaments: Filament[]) {
  const rollen = filaments.map((filament) => ({ filament, ...rolGegevens(filament) }));
  const aantalRollen = rollen.reduce((sum, item) => sum + item.aantal, 0);
  const gramPerRol = rollen[0]?.gram ?? 1000;
  const prijsPerKg = aantalRollen > 0
    ? rollen.reduce((sum, item) => sum + item.filament.prijsPerKg * item.aantal, 0) / aantalRollen
    : filaments[0]?.prijsPerKg ?? 0;
  return { aantalRollen, gramPerRol, voorraadGram: aantalRollen * gramPerRol, prijsPerKg };
}

async function uploadLater(filament: Filament | undefined) {
  if (!filament) return;
  try { await uploadFilament(filament); } catch (error) { console.warn("Filamentupload uitgesteld:", error); }
}

async function mergeDuplicateFilaments() {
  const filaments = await db.filamenten.toArray();
  const groups = new Map<string, Filament[]>();
  for (const filament of filaments) {
    const key = filamentKey(filament);
    groups.set(key, [...(groups.get(key) ?? []), filament]);
  }

  let merged = false;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const primary = [...group].sort((a, b) => Number(Boolean(b.cloudId)) - Number(Boolean(a.cloudId)) || (a.id ?? 0) - (b.id ?? 0))[0];
    const duplicates = group.filter((item) => item.id !== primary.id);
    let canMerge = true;
    for (const duplicate of duplicates) {
      try {
        await deleteCloudFilament(duplicate.cloudId);
      } catch (error) {
        canMerge = false;
        console.warn("Dubbel filament wordt later verwijderd:", error);
        break;
      }
    }
    if (!canMerge) continue;
    merged = true;
    await db.filamenten.update(primary.id!, { ...combinedValues(group), syncPending: true });
    for (const duplicate of duplicates) await db.filamenten.delete(duplicate.id!);
    await uploadLater(await db.filamenten.get(primary.id!));
  }
  return merged;
}

export async function loadFilaments() {
  try { await syncFilaments(); } catch (error) { console.warn("Filamentsync uitgesteld:", error); }
  await mergeDuplicateFilaments();
  return db.filamenten.toArray();
}

export async function createFilament(filament: Omit<Filament, "id" | "cloudId" | "syncKey">) {
  const existing = (await db.filamenten.toArray()).find((item) => filamentKey(item) === filamentKey(filament));
  if (existing?.id !== undefined) {
    await db.filamenten.update(existing.id, { ...combinedValues([existing, filament as Filament]), syncPending: true });
    await uploadLater(await db.filamenten.get(existing.id));
    return { id: existing.id, merged: true };
  }
  const id = await db.filamenten.add(filament);
  const saved = await db.filamenten.get(id);
  await uploadLater(saved);
  return { id, merged: false };
}

export async function updateFilament(id: number, changes: Partial<Filament>) {
  await db.filamenten.update(id, { ...changes, syncPending: true });
  const saved = await db.filamenten.get(id);
  await uploadLater(saved);
  return { merged: await mergeDuplicateFilaments() };
}

export async function deleteFilament(id: number) {
  const filament = await db.filamenten.get(id);
  await deleteCloudFilament(filament?.cloudId);
  await db.filamenten.delete(id);
}
