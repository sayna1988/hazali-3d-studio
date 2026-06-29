import type { JsonValue } from "../../types/Dealtracker.ts";
import type { AdapterError, NormalizedFilamentProduct, ScrapeRunSummary } from "./adapterTypes.ts";
import type { RuntimeRetailer } from "./adapterRegistry.ts";

export type ScrapeRunOptions = {
  dryRun: boolean;
  validateOnly: boolean;
  retailerFilter?: string;
  maxProducts?: number;
  triggerSource: string;
};

export type RetailerWriteResult = {
  offersSeen: number;
  observationsInserted: number;
};

export type DealtrackerRepository = {
  createRun: (options: ScrapeRunOptions) => Promise<string>;
  acquireRunLock: (runId: string, maxRuntimeMs: number) => Promise<boolean>;
  releaseRunLock: (runId: string) => Promise<void>;
  markRunRunning: (runId: string) => Promise<void>;
  finishRun: (runId: string, status: "completed" | "partial" | "failed", exitCode: number, exitReason: string, totals: ScrapeRunTotals) => Promise<void>;
  listActiveRetailers: (retailerFilter?: string) => Promise<RuntimeRetailer[]>;
  startRetailerRun: (runId: string, retailer: RuntimeRetailer) => Promise<void>;
  finishRetailerRun: (runId: string, retailer: RuntimeRetailer, status: "completed" | "partial" | "failed" | "skipped", summary: ScrapeRunSummary, writeResult: RetailerWriteResult) => Promise<void>;
  recordErrors: (runId: string, retailer: RuntimeRetailer | null, errors: AdapterError[]) => Promise<void>;
  writeRetailerProducts: (runId: string, retailer: RuntimeRetailer, products: NormalizedFilamentProduct[], options: Pick<ScrapeRunOptions, "dryRun" | "validateOnly">) => Promise<RetailerWriteResult>;
};

export type ScrapeRunTotals = {
  retailersTotal: number;
  retailersSucceeded: number;
  retailersFailed: number;
  offersSeen: number;
  observationsInserted: number;
};

export type RepositoryRow = Record<string, JsonValue>;
