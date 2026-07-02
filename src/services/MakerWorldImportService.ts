import { import3MF } from "./PrintImportService";
import { db } from "../database/db";
import { savePrint } from "./PrintService";

export interface MakerWorldImportData {
  modelId: string;
  sourceUrl: string;
  title: string;
  summary: string;
  tags: string[];
  images: string[];
  printTimeSeconds: number;
  download: { url: string; name: string; instanceId: string };
}

async function errorMessage(response: Response) {
  try {
    const body = await response.json();
    return body.error || "MakerWorld-import is mislukt.";
  } catch {
    return "MakerWorld-import is mislukt.";
  }
}

async function download3MF(data: MakerWorldImportData) {
  let response: Response;
  try {
    response = await fetch(data.download.url);
    if (!response.ok) throw new Error();
  } catch {
    response = await fetch(`/api/makerworld?modelId=${encodeURIComponent(data.modelId)}&instanceId=${encodeURIComponent(data.download.instanceId)}`);
  }
  if (!response.ok) throw new Error(await errorMessage(response));
  const blob = await response.blob();
  if (!blob.size) throw new Error("Het gedownloade 3MF-bestand is leeg.");
  const baseName = data.download.name.replace(/[\\/:*?"<>|]+/g, "-");
  const fileName = baseName.toLowerCase().endsWith(".3mf") ? baseName : `${baseName}.3mf`;
  return new File([blob], fileName, { type: "application/vnd.ms-package.3dmanufacturing-3dmodel+xml" });
}

export async function loadMakerWorldMetadata(url: string) {
  const response = await fetch("/api/makerworld", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<MakerWorldImportData>;
}

export async function importMakerWorldUrl(url: string, metadata?: MakerWorldImportData, folderId: number | null = null) {
  const data = metadata || await loadMakerWorldMetadata(url);
  const file = await download3MF(data);
  const result = await import3MF(file, folderId);
  const print = await db.prints.get(result.id);
  if (!print) throw new Error("De geïmporteerde print kon niet worden opgeslagen.");

  const updated = {
    ...print,
    naam: data.title || print.naam,
    foto: data.images[0] || print.foto,
    fotos: data.images,
    bronUrl: data.sourceUrl,
    makerWorldId: data.modelId,
    opmerkingen: data.summary || print.opmerkingen,
    tags: [...new Set([...(print.tags || []), ...data.tags])],
  };
  await savePrint(updated);
  return { ...result, print: updated };
}
