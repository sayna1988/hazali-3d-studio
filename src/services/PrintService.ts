import { db } from "../database/db";
import type { Print } from "../types/Print";
import { deleteCloudPrint, syncPrints, uploadPrint } from "./PrintSyncService";

export async function loadPrints() {
  await syncPrints();
  return db.prints.toArray();
}

export async function createPrint(print: Print) {
  const id = await db.prints.add(print);
  const saved = await db.prints.get(id);
  if (saved) await uploadPrint(saved);
  return id;
}

export async function deletePrint(id: number) {
  const print = await db.prints.get(id);
  await deleteCloudPrint(print?.cloudId);
  return db.prints.delete(id);
}

export async function savePrint(print: Print) {
  const kostprijs =
    Number(print.materiaalKosten || 0) +
    Number(print.stroomKosten || 0) +
    Number(print.onderhoudKosten || 0) +
    Number(print.verpakkingKosten || 0) +
    Number(print.overigeKosten || 0);
  const winst = Number(print.verkoopprijs || 0) - kostprijs;

  await db.prints.update(print.id!, { ...print, kostprijs, winst });
  const saved = await db.prints.get(print.id!);
  if (saved) await uploadPrint(saved);
}
