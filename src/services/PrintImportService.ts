import { db } from "../database/db";
import { parse3MFInWorker } from "./ThreeMFWorkerClient";
import { createPrint } from "./PrintService";
import { loadFilaments } from "./FilamentService";

export async function import3MF(file: File, folderId: number | null = null) {

  const result =
    await parse3MFInWorker(file);

  const [filamenten, settings] = await Promise.all([
    loadFilaments(),
    db.settings.toCollection().first()
  ]);
  const materiaal = filamenten.find((item) =>
    result.filamentNaam.toLowerCase().includes(item.type.toLowerCase()) ||
    result.filamentKleuren.some((kleur) => item.kleur.toLowerCase() === kleur.toLowerCase())
  );
  const materiaalKosten = materiaal ? (result.gewicht / 1000) * materiaal.prijsPerKg : 0;
  const printUren = result.uren + result.minuten / 60;
  const stroomKosten = settings ? printUren * (settings.printerVermogen / 1000) * settings.stroomPrijs : 0;
  const onderhoudKosten = settings?.onderhoud ?? 0;
  const verpakkingKosten = settings?.verpakking ?? 0;
  const overigeKosten = settings?.werkKosten ?? 0;
  const kostprijs = materiaalKosten + stroomKosten + onderhoudKosten + verpakkingKosten + overigeKosten;

  const id = await createPrint({

  naam: result.naam,

  foto: result.thumbnail || "",

  bron3mf: file.name,
  bestandsGrootte: result.bestandsGrootte,

  aangemaaktOp:
    new Date().toISOString(),

  folderId,

  gewicht: result.gewicht,

  uren: result.uren,

  minuten: result.minuten,
  printerNaam: result.printerNaam,
  slicer: result.slicer,
  laaghoogte: result.laaghoogte,
  aantalLagen: result.aantalLagen,
  nozzleDiameter: result.nozzleDiameter,
  filamentLengteMeter: result.filamentLengteMeter,
  modelVolumeCm3: result.modelVolumeCm3,
  afmetingen: result.afmetingen,
  objectAantal: result.objectAantal,
  plateAantal: result.plateAantal,
  importWaarschuwingen: result.waarschuwingen,
  metadataBronnen: result.metadataBronnen,

  filamentId: materiaal?.id,

  filamentNaam:
    result.filamentNaam,

  filamenten: result.filamenten,

  filamentKleuren:
    result.filamentKleuren,

  kleurBron: result.kleurBron,
  splitPrint: result.splitPrint,
  splitPrintBron: result.splitPrintBron,

  filamentGewicht:
    result.gewicht,

  amsAfval: 0,

  materiaalKosten,

  stroomKosten,

  onderhoudKosten,

  verpakkingKosten,

  overigeKosten,

  platform: settings?.platform ?? "",

  platformKosten: settings?.platformKosten ?? 0,

  btw: settings?.btw ?? 21,

  gewensteMarge: 0,

  kostprijs,

  verkoopprijs: 0,

  winst: 0

});

  // Bewaar het zware bronbestand los van de metadata, zodat overzichten en sync
  // nooit per ongeluk alle 3MF-Blobs naar het tabgeheugen kopiëren.
  await db.printBestanden.put({ printId: id, bestand: file });

  return { id, ...result, materiaalKosten, stroomKosten, kostprijs };

}
