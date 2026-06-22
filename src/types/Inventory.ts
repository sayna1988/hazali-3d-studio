export interface Inventory {

  id?: number;

  cloudId?: string;

  syncKey?: string;

  syncPending?: boolean;

  printId?: number;

  printCloudId?: string;

  naam: string;

  foto: string;

  sku: string;

  voorraad: number;

  minimumVoorraad: number;

  kostprijs: number;

  verkoopprijs: number;

  locatie: string;

  aangemaaktOp: string;

}
