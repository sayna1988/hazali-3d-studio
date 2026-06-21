export interface Filament {

  id?: number;

  cloudId?: string;

  syncKey?: string;

  syncPending?: boolean;

  naam: string;

  merk: string;

  kleur: string;

  type: string;

  prijsPerKg: number;

  voorraadGram: number;

  ean?: string;

}
