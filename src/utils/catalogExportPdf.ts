import type { jsPDF as JsPDFConstructor } from "jspdf";
import type { Inventory } from "../types/Inventory";
import type { Print } from "../types/Print";

type PdfDocument = InstanceType<typeof JsPDFConstructor>;

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

function inventoryVoorPrint(print: Print, inventaris: Inventory[]) {
  if (print.id === undefined) return undefined;
  return inventaris.find((product) => product.printId === print.id);
}

function voorraadVoorPrint(print: Print, inventaris: Inventory[]) {
  return inventoryVoorPrint(print, inventaris)?.voorraad ?? 0;
}

function hoofdAfbeelding(print: Print, inventaris: Inventory[]) {
  return print.foto || print.fotos?.find(Boolean) || inventoryVoorPrint(print, inventaris)?.foto;
}

async function imageAsDataUrl(url: string) {
  if (url.startsWith("data:")) return url;
  const blobAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const fetchImage = async (source: string) => {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (contentType && !contentType.startsWith("image/")) {
      throw new Error("Response is not an image");
    }
    return await blobAsDataUrl(await response.blob());
  };

  try {
    return await fetchImage(url);
  } catch {
    try {
      const parsed = new URL(url, window.location.origin);
      if (!["http:", "https:"].includes(parsed.protocol)) return undefined;
      return await fetchImage(`/api/image-proxy?url=${encodeURIComponent(parsed.href)}`);
    } catch {
      return undefined;
    }
  }
}

function addCoverImage(pdf: PdfDocument, image: string, x: number, y: number, width: number, height: number) {
  try {
    pdf.addImage(image, "JPEG", x, y, width, height, undefined, "FAST");
  } catch {
    return undefined;
  }
}

async function imageForPdf(url: string) {
  const source = await imageAsDataUrl(url) ?? url;
  if (!source) return undefined;

  return await new Promise<string | undefined>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const size = 240;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(source);
        return;
      }

      context.fillStyle = "#0a213a";
      context.fillRect(0, 0, size, size);
      const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      } catch {
        resolve(undefined);
      }
    };
    image.onerror = () => resolve(undefined);
    image.src = source;
  });
}

function exportDatumTijd() {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "long",
    timeStyle: "short"
  }).format(new Date());
}

function downloadName() {
  const datum = new Date().toISOString().slice(0, 10);
  return `hazali-catalogus-${datum}.pdf`;
}

function addPageBackground(pdf: PdfDocument) {
  pdf.setFillColor(3, 12, 23);
  pdf.rect(0, 0, 210, 297, "F");
  pdf.setFillColor(6, 20, 38);
  pdf.roundedRect(10, 10, 190, 277, 4, 4, "F");
}

function addHeader(pdf: PdfDocument, logo: string | undefined, subtitle: string, prints: Print[], inventaris: Inventory[]) {
  const voorraad = prints.reduce((som, print) => som + voorraadVoorPrint(print, inventaris), 0);
  pdf.setFillColor(8, 26, 48);
  pdf.roundedRect(14, 14, 182, 38, 5, 5, "F");
  if (logo) {
    pdf.addImage(logo, "PNG", 18, 18, 24, 24, undefined, "FAST");
  }
  pdf.setTextColor(240, 247, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("Catalogus", logo ? 48 : 20, 27);
  pdf.setTextColor(126, 151, 181);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(subtitle.slice(0, 42), logo ? 48 : 20, 36);
  const cards = [
    ["Producten", String(prints.length), "zichtbaar"],
    ["Voorraad", String(voorraad), "stuks"]
  ];

  cards.forEach(([label, value, note], index) => {
    const x = 128 + index * 32;
    pdf.setFillColor(10, 33, 58);
    pdf.roundedRect(x, 20, 29, 24, 4, 4, "F");
    pdf.setTextColor(140, 166, 199);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6);
    pdf.text(label.toUpperCase(), x + 3, 27);
    pdf.setTextColor(240, 247, 255);
    pdf.setFontSize(12);
    pdf.text(value, x + 3, 35);
    pdf.setTextColor(101, 126, 159);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(note, x + 3, 41);
  });
}

async function addProductCard(pdf: PdfDocument, print: Print, index: number, x: number, y: number, inventaris: Inventory[]) {
  const voorraad = voorraadVoorPrint(print, inventaris);
  const cardW = 88;
  const cardH = 68;
  const afbeelding = hoofdAfbeelding(print, inventaris);
  const image = afbeelding ? await imageForPdf(afbeelding) : undefined;

  pdf.setFillColor(index % 2 === 0 ? 7 : 9, 24, index % 2 === 0 ? 43 : 48);
  pdf.roundedRect(x, y, cardW, cardH, 4, 4, "F");
  pdf.setDrawColor(31, 156, 255);
  pdf.setLineWidth(0.15);
  pdf.roundedRect(x, y, cardW, cardH, 4, 4, "S");

  pdf.setFillColor(10, 33, 58);
  pdf.roundedRect(x + 4, y + 4, cardW - 8, 36, 3, 3, "F");
  if (image) {
    addCoverImage(pdf, image, x + 4, y + 4, cardW - 8, 36);
  }

  pdf.setTextColor(240, 247, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  const nameLines = pdf.splitTextToSize(print.naam || "Naamloos product", cardW - 8).slice(0, 2);
  pdf.text(nameLines, x + 4, y + 47);

  const values = [
    ["Voorraad", `${voorraad} stuks`],
    ["Verkoopprijs", euro.format(Number(print.verkoopprijs || 0))]
  ];
  values.forEach(([label, value], valueIndex) => {
    const valueX = x + 4 + valueIndex * 42;
    pdf.setTextColor(128, 160, 194);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6);
    pdf.text(label.toUpperCase(), valueX, y + 58);
    pdf.setTextColor(label === "Verkoopprijs" ? 68 : 238, label === "Verkoopprijs" ? 240 : 247, label === "Verkoopprijs" ? 160 : 255);
    pdf.setFontSize(9);
    pdf.text(value, valueX, y + 65);
  });
}

export async function exportCatalogusPdf(prints: Print[], inventaris: Inventory[], actiefFilter: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await imageAsDataUrl("/logo.png");
  const datumTijd = exportDatumTijd();
  const subtitle = `${actiefFilter} - ${datumTijd}`;
  const y = 62;

  addPageBackground(pdf);
  addHeader(pdf, logo, subtitle, prints, inventaris);

  if (!prints.length) {
    pdf.setTextColor(140, 166, 199);
    pdf.setFontSize(12);
    pdf.text("Geen catalogusitems gevonden binnen de huidige filters.", 18, y);
  }

  for (const [index, print] of prints.entries()) {
    const column = index % 2;
    const row = Math.floor(index / 2) % 3;
    if (index > 0 && column === 0 && row === 0) {
      pdf.addPage();
      addPageBackground(pdf);
      addHeader(pdf, logo, subtitle, prints, inventaris);
    }
    await addProductCard(pdf, print, index, 14 + column * 94, 62 + row * 74, inventaris);
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setTextColor(101, 126, 159);
    pdf.setFontSize(7);
    pdf.text(`Hazali - pagina ${page} van ${pages}`, 14, 291);
    pdf.text("www.hazali.nl", 174, 291);
  }

  pdf.save(downloadName());
}
