export interface SlicingColorInput {
  id: string;
  label: string;
  color: string;
  modelGram: number;
  supportGram: number;
  purgedGram: number;
  towerGram: number;
  filamentId?: number;
  filamentNaam?: string;
  filamentPrijsPerKg?: number;
  recognizedTotalGram?: number;
  source: "ocr" | "manual";
}

export interface SlicingColorUsage extends SlicingColorInput {
  printGram: number;
  totalGram: number;
  printCost: number;
  wasteCost: number;
  materialCost: number;
  recognizedDifferenceGram?: number;
}

export interface SlicingTotals {
  colors: number;
  modelGram: number;
  supportGram: number;
  printGram: number;
  purgedGram: number;
  towerGram: number;
  totalGram: number;
  printCost: number;
  wasteCost: number;
  materialCost: number;
  recognizedTotalGram?: number;
}

export interface SlicingParseResult {
  colors: SlicingColorUsage[];
  rawGramRows: number;
  ignoredSummaryRows: number;
  warnings: string[];
}
