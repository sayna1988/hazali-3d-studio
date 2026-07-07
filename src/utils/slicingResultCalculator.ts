import type {
  SlicingColorInput,
  SlicingColorUsage,
  SlicingParseResult,
  SlicingTotals,
} from "../types/Calculator";

const DEFAULT_COLORS = [
  "#F2C14E",
  "#2E3440",
  "#38BDF8",
  "#F87171",
  "#34D399",
  "#A78BFA",
];

type GramCandidate = {
  values: number[];
  lineIndex: number;
  line: string;
  label?: string;
  isSummary: boolean;
};

export function calculateSlicingColorUsage(color: SlicingColorInput): SlicingColorUsage {
  const modelGram = normalizeGram(color.modelGram);
  const supportGram = normalizeGram(color.supportGram);
  const purgedGram = normalizeGram(color.purgedGram);
  const towerGram = normalizeGram(color.towerGram);
  const printGram = roundGram(modelGram + supportGram);
  const totalGram = roundGram(printGram + purgedGram + towerGram);
  const printCost = calculateMaterialCost(printGram, color.filamentPrijsPerKg);
  const wasteCost = calculateMaterialCost(roundGram(purgedGram + towerGram), color.filamentPrijsPerKg);
  const materialCost = roundEuro(printCost + wasteCost);
  const recognizedTotalGram = color.recognizedTotalGram === undefined
    ? undefined
    : normalizeGram(color.recognizedTotalGram);

  return {
    ...color,
    modelGram,
    supportGram,
    purgedGram,
    towerGram,
    recognizedTotalGram,
    printGram,
    totalGram,
    printCost,
    wasteCost,
    materialCost,
    recognizedDifferenceGram: recognizedTotalGram === undefined
      ? undefined
      : roundGram(totalGram - recognizedTotalGram),
  };
}

export function calculateSlicingTotals(colors: SlicingColorInput[]): SlicingTotals {
  const usages = colors.map(calculateSlicingColorUsage);
  const totals = usages.reduce<SlicingTotals>(
    (current, item) => ({
      colors: current.colors + 1,
      modelGram: current.modelGram + item.modelGram,
      supportGram: current.supportGram + item.supportGram,
      printGram: current.printGram + item.printGram,
      purgedGram: current.purgedGram + item.purgedGram,
      towerGram: current.towerGram + item.towerGram,
      totalGram: current.totalGram + item.totalGram,
      printCost: current.printCost + item.printCost,
      wasteCost: current.wasteCost + item.wasteCost,
      materialCost: current.materialCost + item.materialCost,
      recognizedTotalGram: item.recognizedTotalGram === undefined
        ? current.recognizedTotalGram
        : (current.recognizedTotalGram ?? 0) + item.recognizedTotalGram,
    }),
    {
      colors: 0,
      modelGram: 0,
      supportGram: 0,
      printGram: 0,
      purgedGram: 0,
      towerGram: 0,
      totalGram: 0,
      printCost: 0,
      wasteCost: 0,
      materialCost: 0,
    },
  );

  return {
    ...totals,
    modelGram: roundGram(totals.modelGram),
    supportGram: roundGram(totals.supportGram),
    printGram: roundGram(totals.printGram),
    purgedGram: roundGram(totals.purgedGram),
    towerGram: roundGram(totals.towerGram),
    totalGram: roundGram(totals.totalGram),
    printCost: roundEuro(totals.printCost),
    wasteCost: roundEuro(totals.wasteCost),
    materialCost: roundEuro(totals.materialCost),
    recognizedTotalGram: totals.recognizedTotalGram === undefined
      ? undefined
      : roundGram(totals.recognizedTotalGram),
  };
}

export function parseSlicingResultText(text: string): SlicingParseResult {
  const lines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates = lines.flatMap((line, lineIndex) => {
    const values = extractGramValues(line);
    if (values.length < 4) return [];

    const previousLine = lines[lineIndex - 1] ?? "";
    const valueRows = splitGramValueRows(values);
    const labels = findNearestFilamentLabels(lines, lineIndex, valueRows.length);
    const lineHasSummary = hasSummaryLabel(line);
    const previousLineHasSummary = hasSummaryLabel(previousLine);

    return valueRows.map((valueRow, rowIndex) => ({
      values: valueRow,
      lineIndex,
      line,
      label: labels[rowIndex],
      isSummary: lineHasSummary
        ? rowIndex === valueRows.length - 1
        : previousLineHasSummary && valueRows.length === 1,
    }));
  });

  const explicitRows = candidates.filter((candidate) => !candidate.isSummary);
  const implicitSummaryIndex = findImplicitSummaryIndex(explicitRows);
  const dataRows = explicitRows.filter((_, index) => index !== implicitSummaryIndex);
  const ignoredSummaryRows = candidates.length - dataRows.length;

  const colors = dataRows.map((candidate, index) => {
    const values = candidate.values.slice(-5);
    const hasSupportColumn = values.length >= 5;
    const normalizedValues = hasSupportColumn
      ? values
      : [values[0] ?? 0, 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 0];
    const label = candidate.label ?? String(index + 1);

    return calculateSlicingColorUsage({
      id: `ocr-${index + 1}-${label}`,
      label,
      color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      modelGram: normalizedValues[0] ?? 0,
      supportGram: normalizedValues[1] ?? 0,
      purgedGram: normalizedValues[2] ?? 0,
      towerGram: normalizedValues[3] ?? 0,
      recognizedTotalGram: normalizedValues[4],
      source: "ocr",
    });
  });

  const warnings: string[] = [];
  if (colors.length === 0) {
    warnings.push("Geen gramregels gevonden. Controleer de OCR-tekst of vul de kleuren handmatig in.");
  }

  if (colors.some((color) => Math.abs(color.recognizedDifferenceGram ?? 0) > 0.15)) {
    warnings.push("Een of meer OCR-totalen wijken af van de berekende totalen.");
  }

  return {
    colors,
    rawGramRows: candidates.length,
    ignoredSummaryRows,
    warnings,
  };
}

export function applyDetectedSlicingColors(
  rows: SlicingColorInput[],
  detectedColors: string[],
): SlicingColorInput[] {
  return rows.map((row, index) => ({
    ...row,
    color: detectedColors[index] ?? row.color,
  }));
}

export function createManualSlicingColor(index: number): SlicingColorInput {
  const label = String(index + 1);

  return {
    id: `manual-${Date.now()}-${index}`,
    label,
    color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    modelGram: 0,
    supportGram: 0,
    purgedGram: 0,
    towerGram: 0,
    source: "manual",
  };
}

function extractGramValues(line: string) {
  return Array.from(line.matchAll(/([0-9OoIl|]+(?:(?:[.,]\s*|\s+)[0-9OoIl|]{1,2})?)\s*[gq]\b/gi))
    .map((match) => parseOcrNumber(match[1] ?? ""))
    .filter((value): value is number => value !== null);
}

function parseOcrNumber(value: string) {
  const normalized = value
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(",", ".")
    .trim();

  if (normalized.includes(".")) {
    const parsed = Number(normalized.replace(/\s+/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  const spacedDecimal = normalized.match(/^(\d+)\s+(\d{1,2})$/);
  if (spacedDecimal?.[1] && spacedDecimal[2]) {
    const parsed = Number(`${spacedDecimal[1]}.${spacedDecimal[2]}`);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const compact = normalized.replace(/\s+/g, "");
  if (!/^\d+$/.test(compact)) return null;

  const parsed = compact.length >= 2
    ? Number(compact) / 100
    : Number(compact);

  return Number.isFinite(parsed) ? parsed : null;
}

function splitGramValueRows(values: number[]) {
  const columns = values.length % 5 === 0 ? 5 : values.length % 4 === 0 ? 4 : values.length;
  if (values.length === columns) return [values];

  const rows: number[][] = [];
  for (let index = 0; index < values.length; index += columns) {
    rows.push(values.slice(index, index + columns));
  }

  return rows;
}

function findNearestFilamentLabels(
  lines: string[],
  gramLineIndex: number,
  count: number,
) {
  const labels: string[] = [];
  const startIndex = Math.max(0, gramLineIndex - 4);

  for (let lineIndex = startIndex; lineIndex <= gramLineIndex; lineIndex += 1) {
    labels.push(...extractMeterFilamentLabels(lines[lineIndex] ?? ""));
  }

  if (labels.length >= count) return labels.slice(-count);

  if (count === 1) {
    const label = extractFilamentLabel(lines[gramLineIndex] ?? "");
    return label ? [label] : [];
  }

  return labels;
}

function extractMeterFilamentLabels(line: string) {
  if (hasSummaryLabel(line)) return [];

  return Array.from(line.matchAll(/(?:^|\s)(\d{1,2})\s+[0-9OoIl|]+(?:[.,]\s*[0-9OoIl|]+)?\s*m\b/gi))
    .map((match) => match[1])
    .filter((label): label is string => Boolean(label));
}

function extractFilamentLabel(line: string) {
  if (hasSummaryLabel(line)) return undefined;

  const meterRow = line.match(/^\D*(\d{1,2})\s+[0-9OoIl|]+(?:[.,][0-9OoIl|]+)?\s*m\b/i);
  if (meterRow?.[1]) return meterRow[1];

  const gramRow = line.match(/^\D*(\d{1,2})\s+[0-9OoIl|]+(?:[.,][0-9OoIl|]+)?\s*[gq]\b/i);
  return gramRow?.[1];
}

function hasSummaryLabel(line: string) {
  return /\b(total|totaal)\b/i.test(line);
}

function findImplicitSummaryIndex(candidates: GramCandidate[]) {
  if (candidates.length < 2) return -1;

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    const otherRows = candidates.filter((_, rowIndex) => rowIndex !== index);
    if (!candidate || otherRows.length === 0) continue;

    const expectedTotal = sumColumn(otherRows, -1);
    const actualTotal = getColumn(candidate, -1);
    if (!isCloseGram(actualTotal, expectedTotal)) continue;

    const matchingColumns = [-5, -3, -2, -1].filter((column) =>
      isCloseGram(getColumn(candidate, column), sumColumn(otherRows, column)),
    );

    if (matchingColumns.length >= 3) return index;
  }

  return -1;
}

function getColumn(candidate: GramCandidate, columnFromEnd: number) {
  return candidate.values.at(columnFromEnd) ?? 0;
}

function sumColumn(candidates: GramCandidate[], columnFromEnd: number) {
  return roundGram(candidates.reduce((sum, candidate) => sum + getColumn(candidate, columnFromEnd), 0));
}

function isCloseGram(a: number, b: number) {
  return Math.abs(roundGram(a) - roundGram(b)) <= 0.16;
}

function normalizeGram(value: number) {
  return Number.isFinite(value) ? Math.max(0, roundGram(value)) : 0;
}

function roundGram(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateMaterialCost(gram: number, pricePerKg: number | undefined) {
  if (!Number.isFinite(pricePerKg) || pricePerKg === undefined || pricePerKg <= 0) return 0;

  const centigram = Math.round(normalizeGram(gram) * 100);
  const priceCentPerKg = Math.round(pricePerKg * 100);
  const costCent = Math.round((centigram * priceCentPerKg) / 100000);
  return costCent / 100;
}

function roundEuro(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
