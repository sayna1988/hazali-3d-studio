import { db } from "../database/db";
import type { Print } from "../types/Print";
import { queueCloudPrintDeletion, syncPrints, uploadPrint } from "./PrintSyncService";

let legacyFileMigration: Promise<void> | null = null;

function migrateLegacySourceFiles() {
  if (legacyFileMigration) return legacyFileMigration;
  legacyFileMigration = (async () => {
    const ids = await db.prints.toCollection().primaryKeys();
    for (const id of ids) {
      const print = await db.prints.get(id);
      if (!print?.bronBestand || print.id === undefined) continue;
      const bestand = print.bronBestand;
      delete print.bronBestand;
      await db.transaction("rw", db.prints, db.printBestanden, async () => {
        await db.printBestanden.put({ printId: print.id!, bestand });
        await db.prints.put(print);
      });
    }
  })();
  return legacyFileMigration;
}

export function withoutSourceFile(print: Print): Print {
  const summary = { ...print };
  delete summary.bronBestand;
  return summary;
}

export async function loadPrintSummaries() {
  await migrateLegacySourceFiles();
  const summaries: Print[] = [];
  // `each` materialiseert steeds maar één record. Een `toArray()` zou alle grote
  // 3MF-Blobs tegelijk naar het browsergeheugen kopiëren.
  await db.prints.toCollection().each((print) => summaries.push(withoutSourceFile(print)));
  return summaries;
}

export async function loadPrints() {
  await migrateLegacySourceFiles();
  try { await syncPrints(); } catch (error) { console.warn("Printsync uitgesteld:", error); }
  return loadPrintSummaries();
}

async function uploadLater(print: Print | undefined) {
  if (!print) return;
  try { await uploadPrint(print); } catch (error) { console.warn("Printupload uitgesteld:", error); }
}

export async function createPrint(print: Print) {
  const id = await db.prints.add({ ...print, syncPending: true });
  const saved = await db.prints.get(id);
  await uploadLater(saved);
  return id;
}

export async function deletePrint(id: number) {
  const print = await db.prints.get(id);
  if (print?.cloudId) await queueCloudPrintDeletion(print.cloudId);
  await db.transaction("rw", db.prints, db.printBestanden, db.syncDeletions, async () => {
    await db.printBestanden.delete(id);
    await db.prints.delete(id);
  });
  try { await syncPrints(); } catch (error) { console.warn("Printverwijdering uitgesteld:", error); }
}

export async function savePrint(print: Print) {
  const kostprijs =
    Number(print.materiaalKosten || 0) +
    Number(print.stroomKosten || 0) +
    Number(print.onderhoudKosten || 0) +
    Number(print.verpakkingKosten || 0) +
    Number(print.overigeKosten || 0);
  const winst = Number(print.verkoopprijs || 0) - kostprijs;

  await db.prints.update(print.id!, { ...print, kostprijs, winst, syncPending: true });
  const saved = await db.prints.get(print.id!);
  await uploadLater(saved);
}
