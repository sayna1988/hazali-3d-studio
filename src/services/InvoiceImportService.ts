import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { parseInvoiceText } from "./InvoiceParser";

export type InvoiceFilament = {
  id: string;
  selected: boolean;
  name: string;
  brand: string;
  material: "PLA" | "PETG" | "ABS" | "TPU" | "ASA" | "PA" | "PC";
  color: string;
  quantity: number;
  gramsPerSpool: number;
  pricePerSpool: number;
  pricePerKg: number;
  lineTotal: number;
  confidence: number;
  notes: string;
};

export type InvoiceExtraction = {
  supplier: string;
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  filaments: InvoiceFilament[];
  warnings: string[];
};

export type InvoiceProgress = (message: string) => void;

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_PDF_PAGES = 8;
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

type PdfTextItem = { str: string; transform: number[] };

function isPdfTextItem(value: unknown): value is PdfTextItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.str === "string" && Array.isArray(item.transform);
}

function textLinesFromPdfItems(items: unknown[]): string[] {
  const rows: Array<{ y: number; values: Array<{ x: number; text: string }> }> = [];
  for (const item of items.filter(isPdfTextItem)) {
    if (!item.str.trim()) continue;
    const x = Number(item.transform[4] ?? 0);
    const y = Number(item.transform[5] ?? 0);
    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= 2.5);
    if (!row) {
      row = { y, values: [] };
      rows.push(row);
    }
    row.values.push({ x, text: item.str.trim() });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => row.values.sort((a, b) => a.x - b.x).map((value) => value.text).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function imageToCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("De afbeelding kon niet worden voorbereid.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.filter = "grayscale(1) contrast(1.2)";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

async function recognizeCanvases(canvases: HTMLCanvasElement[], onProgress: InvoiceProgress): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  let currentPage = 1;
  const worker = await createWorker(["nld", "eng"], 1, {
    logger: (status) => {
      if (status.status === "recognizing text") {
        onProgress(`Tekst herkennen${canvases.length > 1 ? ` · pagina ${currentPage}/${canvases.length}` : ""} · ${Math.round(status.progress * 100)}%`);
      }
    },
  });
  try {
    await worker.setParameters({ preserve_interword_spaces: "1" });
    const pages: string[] = [];
    for (let index = 0; index < canvases.length; index += 1) {
      currentPage = index + 1;
      const result = await worker.recognize(canvases[index], { rotateAuto: true });
      pages.push(result.data.text);
    }
    return pages.join("\n");
  } finally {
    await worker.terminate();
  }
}

async function extractPdf(file: File, onProgress: InvoiceProgress): Promise<{ text: string; truncated: boolean }> {
  onProgress("PDF lezen…");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdfDocument = await loadingTask.promise;
  const pageCount = Math.min(pdfDocument.numPages, MAX_PDF_PAGES);
  const directPages: string[] = [];
  const scannedPages: HTMLCanvasElement[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    onProgress(`PDF lezen · pagina ${pageNumber}/${pageCount}`);
    const page = await pdfDocument.getPage(pageNumber);
    const content = await page.getTextContent();
    const directText = textLinesFromPdfItems(content.items).join("\n");
    if (directText.replace(/\s/g, "").length >= 60) {
      directPages.push(directText);
      continue;
    }

    const viewport = page.getViewport({ scale: 2 });
    const canvas = globalThis.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Een PDF-pagina kon niet worden weergegeven.");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    scannedPages.push(canvas);
  }

  if (scannedPages.length) directPages.push(await recognizeCanvases(scannedPages, onProgress));
  await loadingTask.destroy();
  return { text: directPages.join("\n"), truncated: pdfDocument.numPages > MAX_PDF_PAGES };
}

export async function extractInvoice(file: File, onProgress: InvoiceProgress = () => undefined): Promise<InvoiceExtraction> {
  const extension = file.name.toLowerCase().split(".").pop();
  const isPdf = file.type === "application/pdf" || extension === "pdf";
  const isImage = file.type.startsWith("image/") && ACCEPTED_TYPES.includes(file.type);
  if (!isPdf && !isImage) throw new Error("Gebruik een PDF-, JPG-, PNG- of WebP-bestand.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Een factuurbestand mag maximaal 15 MB groot zijn.");

  let rawText: string;
  let truncated = false;
  if (isPdf) {
    const result = await extractPdf(file, onProgress);
    rawText = result.text;
    truncated = result.truncated;
  } else {
    onProgress("Afbeelding voorbereiden…");
    rawText = await recognizeCanvases([await imageToCanvas(file)], onProgress);
  }

  onProgress("Filamentregels bepalen…");
  if (rawText.replace(/\s/g, "").length < 20) throw new Error("Er kon onvoldoende leesbare tekst worden gevonden. Gebruik een scherpere scan of foto.");
  const result = parseInvoiceText(rawText);
  if (truncated) result.warnings.push(`Alleen de eerste ${MAX_PDF_PAGES} PDF-pagina's zijn verwerkt.`);
  return result;
}
