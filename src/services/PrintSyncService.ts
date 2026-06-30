import type { Print } from "../types/Print";
import { db } from "../database/db";
import { supabase } from "../lib/supabase";
import { syncCatalogFolders } from "./CatalogFolderSyncService";

type CloudPrint = {
  id: string;
  client_key: string;
  data: Omit<Print, "id" | "cloudId" | "bronBestand" | "folderId">;
};

function cloudData(print: Print): CloudPrint["data"] {
  return Object.fromEntries(
    Object.entries(print).filter(([key]) => !["id", "cloudId", "bronBestand", "syncPending", "folderId"].includes(key))
  ) as CloudPrint["data"];
}

async function currentUserId() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function withFolderCloudId(print: Print) {
  if (print.folderId === null || print.folderId === undefined) return { ...print, folderCloudId: null };
  const folder = await db.folders.get(print.folderId);
  if (!folder) return { ...print, folderId: null, folderCloudId: null };
  return folder.cloudId ? { ...print, folderCloudId: folder.cloudId } : print;
}

async function localData(remote: CloudPrint) {
  const values = { ...remote.data } as Print;
  if (values.folderCloudId) {
    const folder = await db.folders.where("cloudId").equals(values.folderCloudId).first();
    values.folderId = folder?.id ?? null;
  } else {
    values.folderId = null;
  }
  return values;
}

function needsFolderCloudLink(print: Print) {
  return print.folderId !== null && print.folderId !== undefined && !print.folderCloudId;
}

export async function syncPrints() {
  const userId = await currentUserId();
  if (!supabase || !userId) return;
  await syncCatalogFolders();

  // Verwijderingen gaan eerst. Zo kan een oude lokale kopie nooit opnieuw naar
  // de cloud worden geupload voordat de verwijdering is verwerkt.
  const deletions = await db.syncDeletions.where("entity").equals("print").toArray();
  for (const deletion of deletions) {
    if (deletion.userId && deletion.userId !== userId) continue;
    const { error } = await supabase.from("prints").delete().eq("id", deletion.cloudId);
    if (error) throw error;
    await db.syncDeletions.delete(deletion.key);
  }

  const localPrints = await db.prints.toArray();
  for (const original of localPrints.filter((item) => !item.cloudId || item.syncPending || needsFolderCloudLink(item))) {
    if (original.id === undefined) continue;
    const print = await withFolderCloudId(original);
    if (print.folderId !== original.folderId || print.folderCloudId !== original.folderCloudId) {
      await db.prints.update(original.id, {
        folderId: print.folderId ?? null,
        folderCloudId: print.folderCloudId ?? null,
        syncPending: true
      });
    }

    if (print.folderId !== null && print.folderId !== undefined && !print.folderCloudId) continue;

    if (print.cloudId) {
      const { error } = await supabase
        .from("prints")
        .update({ data: cloudData(print), updated_at: new Date().toISOString() })
        .eq("id", print.cloudId);
      if (error) throw error;
      await db.prints.update(original.id, { folderId: print.folderId ?? null, folderCloudId: print.folderCloudId ?? null, syncPending: false });
      continue;
    }
    const syncKey = print.syncKey || crypto.randomUUID();
    if (!print.syncKey) await db.prints.update(original.id, { syncKey });
    const prepared = { ...print, syncKey };
    const { data, error } = await supabase
      .from("prints")
      .upsert({ user_id: userId, client_key: syncKey, data: cloudData(prepared) }, { onConflict: "user_id,client_key" })
      .select("id")
      .single();
    if (error) throw error;
    await db.prints.update(original.id, { cloudId: data.id, syncKey, folderId: print.folderId ?? null, folderCloudId: print.folderCloudId ?? null, syncPending: false });
  }

  const { data: remotePrints, error } = await supabase
    .from("prints")
    .select("id,client_key,data")
    .order("created_at", { ascending: true });
  if (error) throw error;

  // De cloud is leidend voor reeds gesynchroniseerde records. Wat op een ander
  // apparaat is verwijderd, wordt hier inclusief het lokale bronbestand gewist.
  const remoteIds = new Set((remotePrints ?? []).map((remote) => remote.id));
  const removedLocals = (await db.prints.toArray())
    .filter((print) => print.cloudId && !remoteIds.has(print.cloudId));
  await db.transaction("rw", db.prints, db.printBestanden, async () => {
    for (const print of removedLocals) {
      await db.printBestanden.delete(print.id!);
      await db.prints.delete(print.id!);
    }
  });

  for (const remote of (remotePrints ?? []) as CloudPrint[]) {
    const values = await localData(remote);
    const local = await db.prints.where("cloudId").equals(remote.id).first();
    if (local) await db.prints.update(local.id!, { ...values, cloudId: remote.id, syncKey: remote.client_key, syncPending: false });
    else await db.prints.add({ ...values, syncKey: remote.client_key, cloudId: remote.id, syncPending: false } as Print);
  }
}

export async function uploadPrint(print: Print) {
  const userId = await currentUserId();
  if (!supabase || !userId) return;
  await syncCatalogFolders();
  const preparedPrint = await withFolderCloudId(print);
  if (preparedPrint.folderId !== null && preparedPrint.folderId !== undefined && !preparedPrint.folderCloudId) return;

  if (preparedPrint.cloudId) {
    const { error } = await supabase
      .from("prints")
      .update({ data: cloudData(preparedPrint), updated_at: new Date().toISOString() })
      .eq("id", preparedPrint.cloudId);
    if (error) throw error;
    await db.prints.update(preparedPrint.id!, {
      folderId: preparedPrint.folderId ?? null,
      folderCloudId: preparedPrint.folderCloudId ?? null,
      syncPending: false
    });
    return;
  }

  const syncKey = preparedPrint.syncKey || crypto.randomUUID();
  if (!preparedPrint.syncKey) await db.prints.update(preparedPrint.id!, { syncKey });
  const prepared = { ...preparedPrint, syncKey };
  const { data, error } = await supabase
    .from("prints")
    .upsert({ user_id: userId, client_key: syncKey, data: cloudData(prepared) }, { onConflict: "user_id,client_key" })
    .select("id")
    .single();
  if (error) throw error;
  await db.prints.update(preparedPrint.id!, {
    cloudId: data.id,
    syncKey,
    folderId: preparedPrint.folderId ?? null,
    folderCloudId: preparedPrint.folderCloudId ?? null,
    syncPending: false
  });
}

export async function deleteCloudPrint(cloudId?: string) {
  if (!supabase || !cloudId) return;
  const { error } = await supabase.from("prints").delete().eq("id", cloudId);
  if (error) throw error;
}

export async function queueCloudPrintDeletion(cloudId: string) {
  const userId = await currentUserId();
  await db.syncDeletions.put({ key: `print:${cloudId}`, entity: "print", cloudId, userId: userId ?? undefined });
}
