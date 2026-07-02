import { createDealHttpClient } from "./httpClient.ts";
import { createStructuredLogger } from "./logger.ts";
import { runRetailerAdapter } from "./runAdapter.ts";
import { createRetailerAdapter } from "./adapterRegistry.ts";
import type { AdapterLogger } from "./adapterTypes.ts";
import type { DealtrackerRepository, ScrapeRunOptions, ScrapeRunTotals } from "./scrapeRepository.ts";

export type RunDealtrackerOptions = ScrapeRunOptions & {
  maxRuntimeMs: number;
  logger?: AdapterLogger;
};

export type RunDealtrackerResult = {
  runId: string;
  status: "completed" | "partial" | "failed";
  exitCode: number;
  exitReason: string;
  totals: ScrapeRunTotals;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runDealtracker(repository: DealtrackerRepository, options: RunDealtrackerOptions): Promise<RunDealtrackerResult> {
  const logger = options.logger ?? createStructuredLogger({ process: "dealtracker" });
  const runId = await repository.createRun(options);
  const totals: ScrapeRunTotals = {
    retailersTotal: 0,
    retailersSucceeded: 0,
    retailersFailed: 0,
    offersSeen: 0,
    observationsInserted: 0,
  };
  const startedAt = Date.now();
  let hadPartialRetailer = false;

  const locked = await repository.acquireRunLock(runId, options.maxRuntimeMs);
  if (!locked) {
    const exitReason = "Een andere dealtracker-run is al actief.";
    await repository.finishRun(runId, "failed", 75, exitReason, totals);
    return { runId, status: "failed", exitCode: 75, exitReason, totals };
  }

  try {
    await repository.markRunRunning(runId);
    const retailers = await repository.listActiveRetailers(options.retailerFilter);
    totals.retailersTotal = retailers.length;

    if (!retailers.length) {
      const exitReason = options.retailerFilter ? "Geen actieve retailer gevonden voor filter." : "Geen actieve retailers gevonden.";
      await repository.finishRun(runId, "failed", 66, exitReason, totals);
      return { runId, status: "failed", exitCode: 66, exitReason, totals };
    }

    for (const retailer of retailers) {
      if (Date.now() - startedAt >= options.maxRuntimeMs) {
        const timeoutError = [{
          retailerKey: retailer.adapterKey,
          stage: "overview_fetch" as const,
          code: "run_timeout",
          message: "Maximale runtime bereikt voor deze retailer kon starten.",
          retryable: true,
        }];
        await repository.recordErrors(runId, retailer, timeoutError);
        totals.retailersFailed += 1;
        continue;
      }

      const adapter = createRetailerAdapter(retailer);
      await repository.startRetailerRun(runId, retailer);

      if (!adapter) {
        const errors = [{
          retailerKey: retailer.adapterKey,
          stage: "overview_fetch" as const,
          code: "adapter_not_found",
          message: `Geen actieve adapter gevonden voor ${retailer.adapterKey}.`,
          retryable: false,
        }];
        await repository.recordErrors(runId, retailer, errors);
        await repository.finishRetailerRun(runId, retailer, "skipped", {
          retailerKey: retailer.adapterKey,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 0,
          dryRun: options.dryRun,
          productsSeen: 0,
          productsNormalized: 0,
          variantsNormalized: 0,
          offersNormalized: 0,
          duplicateOffersSkipped: 0,
          productErrors: 0,
          fatalErrors: 1,
        }, { offersSeen: 0, observationsInserted: 0 });
        totals.retailersFailed += 1;
        continue;
      }

      try {
        const result = await runRetailerAdapter(adapter, {
          dryRun: options.dryRun,
          now: new Date(),
          logger,
          maxConcurrency: Math.min(3, retailer.maxConcurrency),
          http: createDealHttpClient({
            timeoutMs: retailer.requestTimeoutMs,
            retries: 2,
            retryBaseDelayMs: 500,
            rateLimitMs: retailer.requestDelayMs,
            maxResponseBytes: 5_000_000,
          }),
        });
        const limitedProducts = options.maxProducts ? result.products.slice(0, options.maxProducts) : result.products;
        const writeResult = await repository.writeRetailerProducts(runId, retailer, limitedProducts, options);
        await repository.recordErrors(runId, retailer, result.errors);
        const retailerStatus = result.summary.fatalErrors > 0
          ? "failed"
          : result.errors.length > 0 ? "partial" : "completed";
        await repository.finishRetailerRun(runId, retailer, retailerStatus, result.summary, writeResult);
        totals.offersSeen += writeResult.offersSeen;
        totals.observationsInserted += writeResult.observationsInserted;
        if (retailerStatus === "failed") totals.retailersFailed += 1;
        else {
          totals.retailersSucceeded += 1;
          if (retailerStatus === "partial") hadPartialRetailer = true;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Onbekende retailerfout.";
        await repository.recordErrors(runId, retailer, [{
          retailerKey: retailer.adapterKey,
          stage: "overview_fetch",
          code: "retailer_run_failed",
          message,
          retryable: true,
        }]);
        await repository.finishRetailerRun(runId, retailer, "failed", {
          retailerKey: retailer.adapterKey,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 0,
          dryRun: options.dryRun,
          productsSeen: 0,
          productsNormalized: 0,
          variantsNormalized: 0,
          offersNormalized: 0,
          duplicateOffersSkipped: 0,
          productErrors: 0,
          fatalErrors: 1,
        }, { offersSeen: 0, observationsInserted: 0 });
        totals.retailersFailed += 1;
      }

      if (retailer.requestDelayMs > 0) await sleep(Math.min(retailer.requestDelayMs, 10_000));
    }

    const status = totals.retailersSucceeded === totals.retailersTotal && !hadPartialRetailer
      ? "completed"
      : totals.retailersSucceeded > 0 ? "partial" : "failed";
    const exitCode = status === "completed" ? 0 : status === "partial" ? 2 : 1;
    const exitReason = status === "completed" ? "Alle retailers succesvol verwerkt." : status === "partial" ? "Minimaal een retailer faalde." : "Geen retailer succesvol verwerkt.";
    await repository.finishRun(runId, status, exitCode, exitReason, totals);
    return { runId, status, exitCode, exitReason, totals };
  } finally {
    await repository.releaseRunLock(runId);
  }
}
