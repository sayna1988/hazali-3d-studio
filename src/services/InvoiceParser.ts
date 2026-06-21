import type { InvoiceExtraction, InvoiceFilament } from "./InvoiceImportService";

const MATERIALS: Array<[RegExp, InvoiceFilament["material"]]> = [
  [/\b(?:pet[\s-]?g)\b/i, "PETG"],
  [/\bpla(?:\+| plus| pro| silk| basic| matte| tough| hs| high speed)?\b/i, "PLA"],
  [/\babs(?:\+| plus)?\b/i, "ABS"],
  [/\btpu\b|thermoplastic polyurethane/i, "TPU"],
  [/\basa\b/i, "ASA"],
  [/\b(?:pa\d*|nylon)\b/i, "PA"],
  [/\bpc\b|polycarbonate/i, "PC"],
];

const COLORS: Array<[RegExp, string]> = [
  [/\b(?:zwart|black|noir|schwarz)\b/i, "Zwart"],
  [/\b(?:wit|white|blanc|weiss)\b/i, "Wit"],
  [/\b(?:lichtgrijs|light gr[ae]y)\b/i, "Lichtgrijs"],
  [/\b(?:donkergrijs|dark gr[ae]y|antraciet|anthracite)\b/i, "Donkergrijs"],
  [/\b(?:grijs|gr[ae]y|grau)\b/i, "Grijs"],
  [/\b(?:rood|red|rouge|rot)\b/i, "Rood"],
  [/\b(?:donkerblauw|dark blue|navy)\b/i, "Donkerblauw"],
  [/\b(?:lichtblauw|light blue|cyan|sky blue)\b/i, "Lichtblauw"],
  [/\b(?:blauw|blue|bleu|blau)\b/i, "Blauw"],
  [/\b(?:donkergroen|dark green|forest green)\b/i, "Donkergroen"],
  [/\b(?:lichtgroen|light green|lime|mint)\b/i, "Lichtgroen"],
  [/\b(?:groen|green|vert|grün)\b/i, "Groen"],
  [/\b(?:geel|yellow|jaune|gelb)\b/i, "Geel"],
  [/\b(?:oranje|orange)\b/i, "Oranje"],
  [/\b(?:paars|purple|violet|lila)\b/i, "Paars"],
  [/\b(?:roze|pink|rose|magenta)\b/i, "Roze"],
  [/\b(?:bruin|brown|marron|braun)\b/i, "Bruin"],
  [/\b(?:beige|sand|zand|tan)\b/i, "Beige"],
  [/\b(?:goud|gold)\b/i, "Goud"],
  [/\b(?:zilver|silver)\b/i, "Zilver"],
  [/\b(?:transparant|transparent|clear|naturel|natural)\b/i, "Transparant"],
  [/\b(?:regenboog|rainbow|multicolo(?:u)?r)\b/i, "Multicolor"],
];

const BRANDS = [
  "Bambu Lab", "Polymaker", "PolyTerra", "Fiberlogy", "ColorFabb", "FormFutura",
  "Extrudr", "Spectrum", "Prusament", "AzureFilm", "Fillamentum", "Elegoo",
  "Creality", "Anycubic", "Overture", "Geeetech", "Flashforge", "ERYONE",
  "eSUN", "SUNLU", "JAYO", "SAKATA", "Devil Design", "3DJake",
];

const NON_PRODUCT_LINE = /\b(?:subtotaal|subtotal|totaal|total|btw|vat|tax|verzend|shipping|transport|korting|discount|betaald|payment|iban)\b/i;
const MONEY = /(?:€|eur\s*)?(-?\d{1,6}(?:[.,]\d{2}))\b/gi;
const WEIGHT = /\b(\d+(?:[.,]\d+)?)\s*(kg|kilogram|kilo|g|gr|gram)\b/i;

function decimal(value: string): number {
  const normalized = value.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function materialFrom(line: string): InvoiceFilament["material"] | null {
  return MATERIALS.find(([pattern]) => pattern.test(line))?.[1] ?? null;
}

function colorFrom(line: string): string | null {
  return COLORS.find(([pattern]) => pattern.test(line))?.[1] ?? null;
}

function brandFrom(line: string): string | null {
  return BRANDS.find((brand) => new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]*")}\\b`, "i").test(line)) ?? null;
}

function weightFrom(line: string): number | null {
  const match = line.match(WEIGHT);
  if (!match) return null;
  const value = decimal(match[1]);
  return /kg|kilogram|kilo/i.test(match[2]) ? Math.round(value * 1000) : Math.round(value);
}

function quantityFrom(line: string): number {
  const explicit = line.match(/(?:^|\s)(\d{1,3})\s*[x×]\s*/i)
    ?? line.match(/\b(?:aantal|qty|quantity)\s*[:.]?\s*(\d{1,3})\b/i)
    ?? line.match(/^\s*(\d{1,3})(?:[.,]0{1,2})?\s+(?=[A-Za-z])/);
  if (explicit) return Math.max(1, Number.parseInt(explicit[1], 10));
  return 1;
}

function pricesFrom(line: string): number[] {
  const withoutWeight = line.replace(WEIGHT, " ");
  return [...withoutWeight.matchAll(MONEY)]
    .map((match) => decimal(match[1]))
    .filter((value) => value > 0 && value < 100_000);
}

function cleanName(line: string, material: string, brand: string | null, color: string | null): string {
  let value = line
    .replace(MONEY, " ")
    .replace(WEIGHT, " ")
    .replace(/(?:^|\s)\d{1,3}\s*[x×]\s*/i, " ")
    .replace(/\b(?:art(?:ikel)?\.?|sku|ean|qty|aantal)\s*[:#.]?\s*[\w-]+/gi, " ");
  for (const removable of [brand, color]) {
    if (removable) value = value.replace(new RegExp(removable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
  }
  for (const [pattern] of COLORS) value = value.replace(new RegExp(pattern.source, "ig"), " ");
  value = value
    .replace(new RegExp(`\\b${material.replace("PETG", "PET[\\s-]?G")}\\b`, "ig"), " ")
    .replace(/[|;:_]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s.,+\-–—/]+|[\s.,+\-–—/]+$/g, "")
    .trim();
  if (!value || /^\d+$/.test(value)) return `${material} filament`;
  return value.length > 70 ? `${value.slice(0, 67).trim()}…` : value;
}

function parseDate(value: string): string {
  const match = value.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2}|\d{2})\b/);
  if (!match) return "";
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function metadata(lines: string[]) {
  const text = lines.join("\n");
  const invoiceNumber = text.match(/\b(?:factuurnummer|factuur\s*(?:nr\.?|no\.?|#)|invoice\s*(?:number|no\.?|#)|rechnungsnummer)\s*[:#.]?\s*([A-Z0-9][A-Z0-9\-/]{2,})/i)?.[1] ?? "";
  const labelledDate = text.match(/\b(?:factuurdatum|invoice date|datum|date)\s*[:.]?\s*([^\n]{0,24})/i)?.[1] ?? text;
  const supplier = lines.slice(0, 10).find((line) => {
    const letters = (line.match(/[a-z]/gi) ?? []).length;
    return letters >= 3
      && line.length >= 3
      && line.length <= 70
      && !/factuur|invoice|datum|date|klant|customer|order|bestel|kvk|btw|vat|www\.|@|iban/i.test(line)
      && !/^\W*\d/.test(line);
  }) ?? "";
  return { supplier, invoiceNumber, invoiceDate: parseDate(labelledDate), currency: /€|\bEUR\b/i.test(text) ? "EUR" : "EUR" };
}

function candidateLines(lines: string[]): string[] {
  const result: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!materialFrom(line) || NON_PRODUCT_LINE.test(line)) continue;
    const next = lines[index + 1] ?? "";
    const combined = pricesFrom(line).length === 0 && pricesFrom(next).length > 0 ? `${line} ${next}` : line;
    if (pricesFrom(combined).length > 0 || weightFrom(combined)) result.push(combined);
  }
  return [...new Set(result.map((line) => line.replace(/\s+/g, " ").trim()))];
}

export function parseInvoiceText(rawText: string): InvoiceExtraction {
  const lines = rawText
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const meta = metadata(lines);
  const warnings = ["Lokaal herkend op je apparaat. Controleer aantallen, gewicht en prijzen voor je de regels toevoegt."];

  const filaments = candidateLines(lines).map((line, index): InvoiceFilament => {
    const material = materialFrom(line) ?? "PLA";
    const color = colorFrom(line);
    const brand = brandFrom(line);
    const quantity = quantityFrom(line);
    const grams = weightFrom(line);
    const prices = pricesFrom(line);
    const lineTotal = prices.at(-1) ?? 0;
    const pricePerSpool = lineTotal > 0 ? lineTotal / quantity : 0;
    const notes: string[] = [];
    if (!grams) notes.push("Gewicht niet duidelijk herkend; 1000 g aangenomen.");
    if (!color) notes.push("Kleur niet duidelijk herkend.");
    if (!brand) notes.push("Merk niet duidelijk herkend.");
    if (!lineTotal) notes.push("Prijs niet duidelijk herkend.");
    const finalGrams = grams ?? 1000;
    const confidence = Math.min(.96, .42 + (color ? .12 : 0) + (brand ? .08 : 0) + (grams ? .16 : 0) + (lineTotal ? .18 : 0));

    return {
      id: `invoice-${Date.now()}-${index}`,
      selected: true,
      name: cleanName(line, material, brand, color),
      brand: brand ?? "Onbekend",
      material,
      color: color ?? "Onbekend",
      quantity,
      gramsPerSpool: finalGrams,
      pricePerSpool: Number(pricePerSpool.toFixed(2)),
      pricePerKg: finalGrams > 0 ? Number((pricePerSpool / (finalGrams / 1000)).toFixed(2)) : 0,
      lineTotal: Number(lineTotal.toFixed(2)),
      confidence,
      notes: notes.join(" "),
    };
  });

  if (filaments.some((item) => item.gramsPerSpool === 1000 && item.notes.includes("aangenomen"))) warnings.push("Bij één of meer regels is 1000 g per rol aangenomen.");
  if (!filaments.length) warnings.push("Geen duidelijke filamentregels gevonden; probeer een scherpere, recht van boven gemaakte foto.");
  return { ...meta, filaments, warnings };
}
