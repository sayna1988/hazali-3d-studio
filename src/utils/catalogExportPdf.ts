import type { jsPDF as JsPDFConstructor } from "jspdf";
import type { Inventory } from "../types/Inventory";
import type { Print } from "../types/Print";

type PdfDocument = InstanceType<typeof JsPDFConstructor>;

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

function voorraadVoorPrint(print: Print, inventaris: Inventory[]) {
  if (print.id === undefined) return 0;
  return inventaris.find((product) => product.printId === print.id)?.voorraad ?? 0;
}

async function imageAsDataUrl(url: string) {
  if (url.startsWith("data:")) return url;
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

function addHeader(pdf: PdfDocument, logo: string | undefined, datumTijd: string) {
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
  pdf.text(datumTijd, logo ? 48 : 20, 36);
}

function addSummary(pdf: PdfDocument, prints: Print[], inventaris: Inventory[]) {
  const voorraad = prints.reduce((som, print) => som + voorraadVoorPrint(print, inventaris), 0);
  const verkoopwaarde = prints.reduce((som, print) => som + voorraadVoorPrint(print, inventaris) * Number(print.verkoopprijs || 0), 0);
  const cards = [
    ["Producten", String(prints.length), "zichtbaar"],
    ["Voorraad", String(voorraad), "stuks"],
    ["Verkoopwaarde", euro.format(verkoopwaarde), "op voorraad"]
  ];

  cards.forEach(([label, value, note], index) => {
    const x = 14 + index * 61;
    pdf.setFillColor(10, 33, 58);
    pdf.roundedRect(x, 54, 57, 23, 4, 4, "F");
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

async function addProduct(pdf: PdfDocument, print: Print, index: number, y: number, inventaris: Inventory[]) {
  const voorraad = voorraadVoorPrint(print, inventaris);
  const cardX = 14;
  const cardW = 182;
  const image = print.foto ? await imageAsDataUrl(print.foto) : undefined;

  pdf.setFillColor(index % 2 === 0 ? 7 : 9, 24, index % 2 === 0 ? 43 : 48);
  pdf.roundedRect(cardX, y, cardW, 34, 4, 4, "F");
  pdf.setDrawColor(31, 156, 255);
  pdf.setLineWidth(0.15);
  pdf.roundedRect(cardX, y, cardW, 34, 4, 4, "S");

  pdf.setFillColor(10, 33, 58);
  pdf.roundedRect(cardX + 4, y + 5, 24, 24, 3, 3, "F");
  if (image) {
    try {
      pdf.addImage(image, "JPEG", cardX + 4, y + 5, 24, 24, undefined, "FAST");
    } catch {
      try {
        pdf.addImage(image, "PNG", cardX + 4, y + 5, 24, 24, undefined, "FAST");
      } catch {
        pdf.setTextColor(126, 151, 181);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text(String(index + 1), cardX + 13, y + 19);
      }
    }
  } else {
    pdf.setTextColor(126, 151, 181);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(String(index + 1), cardX + 13, y + 19);
  }

  pdf.setTextColor(240, 247, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text((print.naam || "Naamloos product").slice(0, 58), cardX + 34, y + 12);
  pdf.setTextColor(113, 139, 171);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text(`Catalogusitem ${String(index + 1).padStart(2, "0")}`, cardX + 34, y + 20);

  const values = [
    ["Voorraad", `${voorraad} stuks`],
    ["Verkoopprijs", euro.format(Number(print.verkoopprijs || 0))]
  ];
  values.forEach(([label, value], valueIndex) => {
    const x = cardX + 112 + valueIndex * 33;
    pdf.setTextColor(128, 160, 194);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6);
    pdf.text(label.toUpperCase(), x, y + 12);
    pdf.setTextColor(label === "Verkoopprijs" ? 68 : 238, label === "Verkoopprijs" ? 240 : 247, label === "Verkoopprijs" ? 160 : 255);
    pdf.setFontSize(9);
    pdf.text(value, x, y + 20);
  });
}

export async function exportCatalogusPdf(prints: Print[], inventaris: Inventory[]) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await imageAsDataUrl("/logo.png");
  const datumTijd = exportDatumTijd();
  let y = 84;

  addPageBackground(pdf);
  addHeader(pdf, logo, datumTijd);
  addSummary(pdf, prints, inventaris);

  if (!prints.length) {
    pdf.setTextColor(140, 166, 199);
    pdf.setFontSize(12);
    pdf.text("Geen catalogusitems gevonden binnen de huidige filters.", 18, y);
  }

  for (const [index, print] of prints.entries()) {
    if (y > 260) {
      pdf.addPage();
      addPageBackground(pdf);
      addHeader(pdf, logo, datumTijd);
      y = 58;
    }
    await addProduct(pdf, print, index, y, inventaris);
    y += 38;
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
