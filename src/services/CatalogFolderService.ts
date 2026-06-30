import { db } from "../database/db";
import type { CatalogFolder } from "../types/CatalogFolder";
import type { Print } from "../types/Print";

export type FolderDeleteMode = "recursive" | "promote";

export interface FolderUpdateInput {
  name: string;
  backgroundColor?: string;
  iconImage?: string;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeFolderName(name: string) {
  return name.trim();
}

function comparableFolderName(name: string) {
  return normalizeFolderName(name).toLocaleLowerCase("nl-NL");
}

function sameParent(folder: CatalogFolder, parentId: number | null) {
  return (folder.parentId ?? null) === parentId;
}

async function assertParentExists(parentId: number | null) {
  if (parentId === null) return;
  const parent = await db.folders.get(parentId);
  if (!parent) throw new Error("De bovenliggende map bestaat niet meer.");
}

async function assertUniqueFolderName(name: string, parentId: number | null, ignoreId?: number) {
  const comparableName = comparableFolderName(name);
  const duplicate = await db.folders
    .filter((folder) =>
      folder.id !== ignoreId &&
      sameParent(folder, parentId) &&
      comparableFolderName(folder.name) === comparableName
    )
    .first();

  if (duplicate) throw new Error("Er bestaat al een map met deze naam op deze plek.");
}

export async function loadCatalogFolders() {
  return db.folders.orderBy("sortOrder").toArray();
}

export async function createFolder(name: string, parentId: number | null) {
  const trimmedName = normalizeFolderName(name);
  if (!trimmedName) throw new Error("Voer een mapnaam in.");
  await assertParentExists(parentId);
  await assertUniqueFolderName(trimmedName, parentId);

  const siblingCount = await db.folders.filter((folder) => sameParent(folder, parentId)).count();
  const createdAt = nowIso();
  return db.folders.add({
    name: trimmedName,
    parentId,
    createdAt,
    updatedAt: createdAt,
    sortOrder: siblingCount
  });
}

export async function renameFolder(folderId: number, input: FolderUpdateInput) {
  const trimmedName = normalizeFolderName(input.name);
  if (!trimmedName) throw new Error("Voer een mapnaam in.");
  const folder = await db.folders.get(folderId);
  if (!folder) throw new Error("Deze map bestaat niet meer.");
  await assertUniqueFolderName(trimmedName, folder.parentId ?? null, folderId);
  await db.folders.update(folderId, {
    name: trimmedName,
    backgroundColor: input.backgroundColor || undefined,
    iconImage: input.iconImage || undefined,
    updatedAt: nowIso()
  });
}

export async function getChildFolders(parentId: number | null) {
  const folders = await db.folders.filter((folder) => sameParent(folder, parentId)).toArray();
  return folders.sort(sortFolders);
}

export async function getDescendantFolderIds(folderId: number) {
  const descendants: number[] = [];
  const visited = new Set<number>([folderId]);
  let queue = [folderId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (currentId === undefined) break;
    const children = await db.folders.where("parentId").equals(currentId).toArray();
    const childIds = children
      .map((folder) => folder.id)
      .filter((id): id is number => id !== undefined && !visited.has(id));
    childIds.forEach((id) => visited.add(id));
    descendants.push(...childIds);
    queue = [...queue, ...childIds];
  }

  return descendants;
}

export async function moveFolder(folderId: number, targetParentId: number | null) {
  const folder = await db.folders.get(folderId);
  if (!folder) throw new Error("Deze map bestaat niet meer.");
  if (folderId === targetParentId) throw new Error("Een map kan niet naar zichzelf worden verplaatst.");
  await assertParentExists(targetParentId);

  const descendantIds = await getDescendantFolderIds(folderId);
  if (targetParentId !== null && descendantIds.includes(targetParentId)) {
    throw new Error("Een map kan niet naar een eigen submap worden verplaatst.");
  }

  await assertUniqueFolderName(folder.name, targetParentId, folderId);
  await db.folders.update(folderId, { parentId: targetParentId, updatedAt: nowIso() });
}

export async function moveCatalogItem(printId: number, folderId: number | null) {
  await assertParentExists(folderId);
  await db.prints.update(printId, { folderId, syncPending: true });
}

export async function moveCatalogItems(printIds: number[], folderId: number | null) {
  const uniquePrintIds = [...new Set(printIds)];
  if (uniquePrintIds.length === 0) return;
  await assertParentExists(folderId);

  await db.transaction("rw", db.prints, async () => {
    for (const printId of uniquePrintIds) {
      await db.prints.update(printId, { folderId, syncPending: true });
    }
  });
}

export async function getFolderPath(folderId: number | null, folders?: CatalogFolder[]) {
  if (folderId === null) return [];
  const allFolders = folders ?? await db.folders.toArray();
  const byId = new Map(allFolders.filter((folder) => folder.id !== undefined).map((folder) => [folder.id!, folder]));
  const path: CatalogFolder[] = [];
  const visited = new Set<number>();
  let currentId: number | null | undefined = folderId;

  while (currentId !== null && currentId !== undefined && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = byId.get(currentId);
    if (!folder) break;
    path.unshift(folder);
    currentId = folder.parentId ?? null;
  }

  return path;
}

export function sortFolders(a: CatalogFolder, b: CatalogFolder) {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "nl");
}

export function sortPrints(prints: Print[], sortering: string, pricingByPrintId: Record<number, { winst: number }>) {
  return [...prints].sort((a, b) => {
    if (sortering === "naam-az") return a.naam.localeCompare(b.naam, "nl");
    if (sortering === "naam-za") return b.naam.localeCompare(a.naam, "nl");
    if (sortering === "oudste") return (a.id || 0) - (b.id || 0);
    if (sortering === "winst") return (b.id === undefined ? b.winst : pricingByPrintId[b.id]?.winst ?? b.winst) - (a.id === undefined ? a.winst : pricingByPrintId[a.id]?.winst ?? a.winst);
    if (sortering === "verkoopprijs") return b.verkoopprijs - a.verkoopprijs;
    return (b.id || 0) - (a.id || 0);
  });
}

export async function getFolderContentCounts(folderId: number) {
  const [childFolderCount, itemCount] = await Promise.all([
    db.folders.where("parentId").equals(folderId).count(),
    db.prints.where("folderId").equals(folderId).count()
  ]);
  return { childFolderCount, itemCount };
}

export async function deleteFolder(folderId: number, mode: FolderDeleteMode) {
  const folder = await db.folders.get(folderId);
  if (!folder) throw new Error("Deze map bestaat niet meer.");

  const descendantIds = await getDescendantFolderIds(folderId);
  const folderIds = [folderId, ...descendantIds];
  const parentId = folder.parentId ?? null;

  await db.transaction("rw", [db.folders, db.prints, db.printBestanden, db.inventory, db.syncDeletions], async () => {
    if (mode === "promote") {
      await db.folders.where("parentId").equals(folderId).modify({ parentId, updatedAt: nowIso() });
      await db.prints.where("folderId").equals(folderId).modify({ folderId: parentId, syncPending: true });
      await db.folders.delete(folderId);
      return;
    }

    const printsToDelete = await db.prints.filter((print) => print.folderId !== undefined && print.folderId !== null && folderIds.includes(print.folderId)).toArray();
    const printIds = printsToDelete.map((print) => print.id).filter((id): id is number => id !== undefined);
    const cloudIds = printsToDelete.map((print) => print.cloudId).filter((cloudId): cloudId is string => Boolean(cloudId));

    if (printIds.length > 0) {
      await db.printBestanden.bulkDelete(printIds);
      await db.inventory.where("printId").anyOf(printIds).delete();
      await db.prints.bulkDelete(printIds);
    }

    for (const cloudId of cloudIds) {
      await db.syncDeletions.put({ key: `print:${cloudId}`, entity: "print", cloudId });
    }

    await db.folders.bulkDelete(folderIds);
  });
}
