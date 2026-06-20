export interface Print {

  id?: number;
  cloudId?: string;
  syncKey?: string;

  // Algemene gegevens

  naam: string;
  foto?: string;
  bron3mf?: string;
  bronBestand?: Blob;
  bestandsGrootte?: number;
  aangemaaktOp: string;
  opmerkingen?: string;
  tags?: string[];

  // Printgegevens

  gewicht: number;
  uren: number;
  minuten: number;
  printerNaam?: string;
  slicer?: string;
  laaghoogte?: number;
  aantalLagen?: number;
  nozzleDiameter?: number;
  filamentLengteMeter?: number;
  modelVolumeCm3?: number;
  afmetingen?: { x: number; y: number; z: number };
  objectAantal?: number;
  plateAantal?: number;
  importWaarschuwingen?: string[];
  metadataBronnen?: string[];

  // Filament

  filamentId?: number;
  filamentNaam?: string;
  filamenten?: Array<{ kleur: string; gewicht: number; lengteMeter?: number; materiaal?: string }>;
  filamentKleuren: string[];
  kleurBron?: "3mf-metadata" | "preview" | "geen";
  filamentGewicht: number;
  amsAfval: number;

  // Kosten

  materiaalKosten: number;
  stroomKosten: number;
  onderhoudKosten: number;
  verpakkingKosten: number;
  overigeKosten: number;

  // Verkoop

  platform: string;
  platformKosten: number;
  btw: number;
  gewensteMarge: number;

  // Resultaat

  kostprijs: number;
  verkoopprijs: number;
  winst: number;
}
