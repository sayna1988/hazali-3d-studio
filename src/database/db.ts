import Dexie from "dexie";

import type { Print } from "../types/Print";
import type { Filament } from "../types/Filament";
import type { SettingsModel } from "../types/Settings";
import type { Inventory } from "../types/Inventory";
import type { CatalogFolder } from "../types/CatalogFolder";

export class HazaliDatabase extends Dexie {

  filamenten!: Dexie.Table<Filament, number>;

  prints!: Dexie.Table<Print, number>;

  folders!: Dexie.Table<CatalogFolder, number>;

  printBestanden!: Dexie.Table<{ printId: number; bestand: Blob }, number>;

  syncDeletions!: Dexie.Table<{ key: string; entity: "print" | "inventory" | "filament" | "folder"; cloudId: string; userId?: string }, string>;

  settings!: Dexie.Table<SettingsModel, number>;

    inventory!: Dexie.Table<Inventory, number>;

  constructor() {

    super(
      "HazaliDatabase"
    );

    this.version(5).stores({

      filamenten: "++id, naam, merk, kleur, type",

      prints: "++id, naam, aangemaaktOp",

      settings: "++id",

      inventory: "++id,naam,sku,voorraad"

    });

    this.version(6).stores({

      filamenten: "++id, naam, merk, kleur, type, ean",

      prints: "++id, naam, aangemaaktOp",

      settings: "++id",

      inventory: "++id,naam,sku,voorraad"

    });

    this.version(7).stores({
      filamenten: "++id, naam, merk, kleur, type, ean",
      prints: "++id, &cloudId, naam, aangemaaktOp",
      settings: "++id",
      inventory: "++id,naam,sku,voorraad"
    });

    this.version(8).stores({
      filamenten: "++id, &cloudId, syncKey, naam, merk, kleur, type, ean",
      prints: "++id, &cloudId, naam, aangemaaktOp",
      settings: "++id",
      inventory: "++id,naam,sku,voorraad"
    });

    this.version(9).stores({
      filamenten: "++id, &cloudId, syncKey, naam, merk, kleur, type, ean",
      prints: "++id, &cloudId, naam, aangemaaktOp",
      printBestanden: "&printId",
      settings: "++id",
      inventory: "++id,naam,sku,voorraad"
    });

    this.version(10).stores({
      filamenten: "++id, &cloudId, syncKey, naam, merk, kleur, type, ean",
      prints: "++id, &cloudId, syncKey, naam, aangemaaktOp",
      printBestanden: "&printId",
      syncDeletions: "&key, entity, userId",
      settings: "++id",
      inventory: "++id,naam,sku,voorraad"
    });

    this.version(11).stores({
      filamenten: "++id, &cloudId, syncKey, naam, merk, kleur, type, ean",
      prints: "++id, &cloudId, syncKey, naam, aangemaaktOp",
      printBestanden: "&printId",
      syncDeletions: "&key, entity, userId",
      settings: "++id",
      inventory: "++id, &cloudId, syncKey, printId, printCloudId, naam, sku, voorraad"
    });

    this.version(12).stores({
      filamenten: "++id, &cloudId, syncKey, naam, merk, kleur, type, ean",
      prints: "++id, &cloudId, syncKey, naam, aangemaaktOp",
      printBestanden: "&printId",
      syncDeletions: "&key, entity, userId",
      settings: "++id",
      inventory: "++id, &cloudId, syncKey, printId, printCloudId, naam, sku, voorraad"
    });

    this.version(13).stores({
      filamenten: "++id, &cloudId, syncKey, naam, merk, kleur, type, ean",
      prints: "++id, &cloudId, syncKey, naam, folderId, aangemaaktOp",
      folders: "++id, name, parentId, createdAt, updatedAt, sortOrder",
      printBestanden: "&printId",
      syncDeletions: "&key, entity, userId",
      settings: "++id",
      inventory: "++id, &cloudId, syncKey, printId, printCloudId, naam, sku, voorraad"
    });

    this.version(14).stores({
      filamenten: "++id, &cloudId, syncKey, naam, merk, kleur, type, ean",
      prints: "++id, &cloudId, syncKey, naam, folderId, folderCloudId, aangemaaktOp",
      folders: "++id, &cloudId, syncKey, name, parentId, parentCloudId, createdAt, updatedAt, sortOrder",
      printBestanden: "&printId",
      syncDeletions: "&key, entity, userId",
      settings: "++id",
      inventory: "++id, &cloudId, syncKey, printId, printCloudId, naam, sku, voorraad"
    });

  }

}

export const db =
  new HazaliDatabase();
