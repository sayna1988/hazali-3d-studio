import Dexie from "dexie";

import type { Print } from "../types/Print";
import type { Filament } from "../types/Filament";
import type { SettingsModel } from "../types/Settings";
import type { Inventory } from "../types/Inventory";

export class HazaliDatabase extends Dexie {

  filamenten!: Dexie.Table<Filament, number>;

  prints!: Dexie.Table<Print, number>;

  printBestanden!: Dexie.Table<{ printId: number; bestand: Blob }, number>;

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

  }

}

export const db =
  new HazaliDatabase();
