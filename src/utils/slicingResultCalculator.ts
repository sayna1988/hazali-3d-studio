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

type OcrNumberToken = {
  raw: string;
  value: number;
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
    const previousLine = lines[lineIndex - 1] ?? "";
    const values = extractGramValues(line, previousLine);
    if (values.length < 3) return [];

    const columnCount = detectGramColumnCount(lines, lineIndex, values);
    const valueRows = splitGramValueRows(values, columnCount);
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
    const normalizedValues = normalizeGramColumns(candidate.values);
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

function extractGramValues(line: string, previousLine: string) {
  const explicitValues = Array.from(line.matchAll(/([0-9OoIl|]+(?:(?:[.,]\s*|\s+)[0-9OoIl|]{1,2})?)\s*[gq]\b/gi))
    .map((match) => parseOcrNumber(match[1] ?? ""))
    .filter((value): value is number => value !== null);

  if (explicitValues.length >= 3) return explicitValues;
  if (explicitValues.length > 0) {
    const mixedValues = extractUnitlessGramValues(line, previousLine);
    if (mixedValues.length >= 3) return mixedValues;
  }

  if (!isLikelyUnitlessGramLine(line, previousLine)) return explicitValues;

  return extractUnitlessGramValues(line, previousLine);
}

function parseOcrNumber(value: string) {
  const normalized = value
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(",", ".")
    .trim();

  if (normalized.includes(".")) {
    const compactDecimal = normalized.replace(/\s+/g, "");
    const decimalMatch = compactDecimal.match(/^(\d+)\.(\d+)$/);
    const parsed = decimalMatch?.[1] && decimalMatch[2]
      ? Number(`${decimalMatch[1]}.${decimalMatch[2].slice(0, 2)}`)
      : Number(compactDecimal);
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

function detectGramColumnCount(lines: string[], gramLineIndex: number, values: number[]) {
  const headerContext = lines
    .slice(Math.max(0, gramLineIndex - 6), gramLineIndex + 1)
    .join(" ")
    .toLowerCase();

  if (/\bmodel\b/.test(headerContext) && /\bsupport\b/.test(headerContext) && /\btotal\b/.test(headerContext) && !/\b(purged|tower)\b/.test(headerContext)) {
    return 3;
  }

  if (/\b(purged|tower)\b/.test(headerContext)) {
    return /\bsupport\b/.test(headerContext) ? 5 : 4;
  }

  if (values.length % 5 === 0) return 5;
  if (values.length % 4 === 0) return 4;
  if (values.length % 3 === 0) return 3;

  return values.length;
}

function splitGramValueRows(values: number[], columns: number) {
  if (values.length === columns) return [values];

  const rows: number[][] = [];
  for (let index = 0; index < values.length; index += columns) {
    rows.push(values.slice(index, index + columns));
  }

  return rows;
}

function normalizeGramColumns(values: number[]) {
  const rowValues = values.slice(-5);

  if (rowValues.length >= 5) return rowValues;
  if (rowValues.length === 4) return [rowValues[0] ?? 0, 0, rowValues[1] ?? 0, rowValues[2] ?? 0, rowValues[3] ?? 0];
  if (rowValues.length === 3) return [rowValues[0] ?? 0, rowValues[1] ?? 0, 0, 0, rowValues[2] ?? 0];

  return [rowValues[0] ?? 0, 0, 0, 0, rowValues[1] ?? rowValues[0] ?? 0];
}

function isLikelyUnitlessGramLine(line: string, previousLine: string) {
  if (/[gq]\b/i.test(line)) return false;
  if (/[a-z]/i.test(line.replace(/[OoIl]/g, ""))) return false;
  if (!/\bm\b/i.test(previousLine)) return false;

  return extractUnitlessGramValues(line, previousLine).length >= 3;
}

function extractUnitlessGramValues(line: string, previousLine = "") {
  const tokens = extractUnitlessGramTokens(line);
  return normalizeGramTokensAgainstMeters(tokens, previousLine);
}

function extractUnitlessGramTokens(line: string): OcrNumberToken[] {
  const normalized = line
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(",", ".")
    .trim();

  if (normalized.includes(".")) {
    return Array.from(normalized.matchAll(/\d+(?:\.\s*\d+)?/g))
      .map((match) => {
        const raw = match[0] ?? "";
        return {
          raw,
          value: parseOcrNumber(raw),
        };
      })
      .filter((token): token is OcrNumberToken => token.value !== null);
  }

  const tokens = normalized.match(/\d+/g) ?? [];
  if (tokens.length >= 6 && tokens.length % 2 === 0 && tokens.every((token) => token.length <= 2)) {
    const values: OcrNumberToken[] = [];
    for (let index = 0; index < tokens.length; index += 2) {
      const raw = `${tokens[index]} ${tokens[index + 1]}`;
      const parsed = parseOcrNumber(raw);
      if (parsed !== null) values.push({ raw, value: parsed });
    }
    return values;
  }

  return tokens
    .map((token) => ({
      raw: token,
      value: parseOcrNumber(token),
    }))
    .filter((token): token is OcrNumberToken => token.value !== null);
}

function normalizeGramTokensAgainstMeters(tokens: OcrNumberToken[], previousLine: string) {
  const meterValues = extractMeterValues(previousLine);

  return tokens.map((token, index) => {
    const compact = token.raw.replace(/\D/g, "");
    const meterValue = meterValues[index];
    if (
      compact.length >= 5 &&
      compact.endsWith("9") &&
      meterValue !== undefined &&
      meterValue > 0 &&
      token.value > meterValue * 10
    ) {
      const corrected = parseOcrNumber(compact.slice(0, -1));
      if (corrected !== null && corrected <= meterValue * 10) return corrected;
    }

    return token.value;
  });
}

function extractMeterValues(line: string) {
  return Array.from(line.matchAll(/([0-9OoIl|]+(?:(?:[.,]\s*|\s+)[0-9OoIl|]{1,2})?)\s*m\b/gi))
    .map((match) => parseOcrNumber(match[1] ?? ""))
    .filter((value): value is number => value !== null);
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

  return Array.from(line.matchAll(/(?:^|[^\d])(\d{1,2})\s+[0-9OoIl|]+(?:[.,]\s*[0-9OoIl|]+)?\s*m\b/gi))
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
