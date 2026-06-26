import type { jsPDF as JsPDFConstructor } from "jspdf";
import type { Inventory } from "../types/Inventory";
import type { Filament } from "../types/Filament";
import type { Print } from "../types/Print";
import { berekenCatalogusPrijs } from "./printPricing";

type PdfDocument = InstanceType<typeof JsPDFConstructor>;

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const number = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 });

function voorraadVoorPrint(print: Print, inventaris: Inventory[]) {
  if (print.id === undefined) return 0;
  return inventaris.find((product) => product.printId === print.id)?.voorraad ?? 0;
}

async function imageAsDataUrl(url: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
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

function addHeader(pdf: PdfDocument, logo?: string) {
  pdf.setFillColor(8, 26, 48);
  pdf.roundedRect(14, 14, 182, 34, 5, 5, "F");
  if (logo) {
    pdf.addImage(logo, "PNG", 18, 18, 24, 24, undefined, "FAST");
  }
  pdf.setTextColor(240, 247, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("Hazali Catalogus", logo ? 48 : 20, 27);
  pdf.setTextColor(126, 151, 181);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Export van zichtbare catalogusitems - ${new Date().toLocaleDateString("nl-NL")}`, logo ? 48 : 20, 36);
}

function addSummary(pdf: PdfDocument, prints: Print[], inventaris: Inventory[], filamenten: Filament[]) {
  const voorraad = prints.reduce((som, print) => som + voorraadVoorPrint(print, inventaris), 0);
  const verkoopwaarde = prints.reduce((som, print) => som + voorraadVoorPrint(print, inventaris) * Number(print.verkoopprijs || 0), 0);
  const winst = prints.reduce((som, print) => som + berekenCatalogusPrijs(print, filamenten).winst, 0);
  const cards = [
    ["Producten", String(prints.length), "zichtbaar"],
    ["Voorraad", String(voorraad), "stuks"],
    ["Verkoopwaarde", euro.format(verkoopwaarde), "op voorraad"],
    ["Winst per set", euro.format(winst), "gefilterd"]
  ];

  cards.forEach(([label, value, note], index) => {
    const x = 14 + index * 46;
    pdf.setFillColor(10, 33, 58);
    pdf.roundedRect(x, 54, 42, 23, 4, 4, "F");
    pdf.setTextColor(140, 166, 199);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.text(label.toUpperCase(), x + 4, 62);
    pdf.setTextColor(240, 247, 255);
    pdf.setFontSize(12);
    pdf.text(value, x + 4, 69);
    pdf.setTextColor(101, 126, 159);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(note, x + 4, 74);
  });
}

function addProduct(pdf: PdfDocument, print: Print, index: number, y: number, inventaris: Inventory[], filamenten: Filament[]) {
  const pricing = berekenCatalogusPrijs(print, filamenten);
  const voorraad = voorraadVoorPrint(print, inventaris);
  const cardX = 14;
  const cardW = 182;

  pdf.setFillColor(index % 2 === 0 ? 7 : 9, 24, index % 2 === 0 ? 43 : 48);
  pdf.roundedRect(cardX, y, cardW, 25, 4, 4, "F");
  pdf.setDrawColor(31, 156, 255);
  pdf.setLineWidth(0.15);
  pdf.roundedRect(cardX, y, cardW, 25, 4, 4, "S");

  pdf.setFillColor(31, 156, 255);
  pdf.roundedRect(cardX + 4, y + 5, 15, 15, 3, 3, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text(String(index + 1).padStart(2, "0"), cardX + 7, y + 14);

  pdf.setTextColor(240, 247, 255);
  pdf.setFontSize(10);
  pdf.text((print.naam || "Naamloos product").slice(0, 52), cardX + 24, y + 8);
  pdf.setTextColor(113, 139, 171);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text(`${number.format(Number(print.gewicht || 0))} g filament - ${print.uren}u ${print.minuten}m - ${voorraad} op voorraad`, cardX + 24, y + 14);
  const tags = (print.tags ?? []).slice(0, 4).join("  /  ");
  if (tags) pdf.text(tags.slice(0, 60), cardX + 24, y + 20);

  const values = [
    ["VK", euro.format(Number(print.verkoopprijs || 0))],
    ["Kost", euro.format(pricing.kostprijs)],
    ["Winst", euro.format(pricing.winst)]
  ];
  values.forEach(([label, value], valueIndex) => {
    const x = cardX + 112 + valueIndex * 23;
    pdf.setTextColor(128, 160, 194);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6);
    pdf.text(label.toUpperCase(), x, y + 8);
    pdf.setTextColor(label === "Winst" && pricing.winst < 0 ? 255 : 68, label === "Winst" && pricing.winst < 0 ? 107 : 240, label === "Winst" && pricing.winst < 0 ? 122 : 160);
    if (label !== "Winst") pdf.setTextColor(238, 247, 255);
    pdf.setFontSize(8);
    pdf.text(value, x, y + 15);
  });
}

export async function exportCatalogusPdf(prints: Print[], inventaris: Inventory[], filamenten: Filament[]) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await imageAsDataUrl("/logo.png");
  let y = 84;

  addPageBackground(pdf);
  addHeader(pdf, logo);
  addSummary(pdf, prints, inventaris, filamenten);

  if (!prints.length) {
    pdf.setTextColor(140, 166, 199);
    pdf.setFontSize(12);
    pdf.text("Geen catalogusitems gevonden binnen de huidige filters.", 18, y);
  }

  prints.forEach((print, index) => {
    if (y > 260) {
      pdf.addPage();
      addPageBackground(pdf);
      addHeader(pdf, logo);
      y = 58;
    }
    addProduct(pdf, print, index, y, inventaris, filamenten);
    y += 29;
  });

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
