import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";
import test from "node:test";
import type { JsonValue } from "../src/types/Dealtracker.ts";
import type { AdapterError, NormalizedFilamentProduct, ScrapeRunSummary } from "../src/services/dealtracker/adapterTypes.ts";
import type { RuntimeRetailer } from "../src/services/dealtracker/adapterRegistry.ts";
import { createSilentLogger } from "../src/services/dealtracker/logger.ts";
import { runDealtracker } from "../src/services/dealtracker/scrapeOrchestrator.ts";
import type { DealtrackerRepository, RetailerWriteResult, ScrapeRunOptions, ScrapeRunTotals } from "../src/services/dealtracker/scrapeRepository.ts";

type RunRecord = {
  id: string;
  status: string;
  exitCode?: number;
  exitReason?: string;
  totals?: ScrapeRunTotals;
};

const joybuyFixture = await readFile(resolve("tests/fixtures/dealtracker/joybuy-awin-feed.csv"), "utf8");
const validJoybuyFeed = [
  "id,title,brand,link,price,shipping_price,availability",
  "ok-1,\"CAILAB PLA 1 kg - Zwart\",CaiLab,https://www.joybuy.nl/dp/ok/1,9.99 EUR,0 EUR,in stock",
  "ok-2,\"CAILAB PLA+ 1 kg - Wit\",CaiLab,https://www.joybuy.nl/dp/ok/2,10.99 EUR,0 EUR,in stock",
].join("\n");

function retailer(overrides: Partial<RuntimeRetailer> = {}): RuntimeRetailer {
  return {
    id: overrides.id ?? "retailer-1",
    name: overrides.name ?? "Joybuy",
    domain: overrides.domain ?? "www.joybuy.nl",
    active: overrides.active ?? true,
    adapterKey: overrides.adapterKey ?? "joybuy-nl",
    config: overrides.config ?? { feedText: joybuyFixture },
    requestDelayMs: overrides.requestDelayMs ?? 0,
    requestTimeoutMs: overrides.requestTimeoutMs ?? 1000,
    maxConcurrency: overrides.maxConcurrency ?? 3,
  };
}

class MemoryRepository implements DealtrackerRepository {
  readonly runs: RunRecord[] = [];
  readonly errors: AdapterError[] = [];
  readonly retailerStatuses: string[] = [];
  readonly observations = new Set<string>();
  locked = false;
  failWrites = false;

  private readonly retailers: RuntimeRetailer[];

  constructor(retailers: RuntimeRetailer[]) {
    this.retailers = retailers;
  }

  async createRun(options: ScrapeRunOptions) {
    void options;
    const id = `run-${this.runs.length + 1}`;
    this.runs.push({ id, status: "pending" });
    return id;
  }

  async acquireRunLock(runId: string) {
    void runId;
    if (this.locked) return false;
    this.locked = true;
    return true;
  }

  async releaseRunLock() {
    this.locked = false;
  }

  async markRunRunning(runId: string) {
    this.runs.find((run) => run.id === runId)!.status = "running";
  }

  async finishRun(runId: string, status: "completed" | "partial" | "failed", exitCode: number, exitReason: string, totals: ScrapeRunTotals) {
    const run = this.runs.find((item) => item.id === runId)!;
    run.status = status;
    run.exitCode = exitCode;
    run.exitReason = exitReason;
    run.totals = totals;
  }

  async listActiveRetailers(retailerFilter?: string) {
    return this.retailers.filter((item) =>
      item.active && (!retailerFilter || item.adapterKey === retailerFilter || item.domain === retailerFilter),
    );
  }

  async startRetailerRun() {
    return undefined;
  }

  async finishRetailerRun(runId: string, retailer: RuntimeRetailer, status: "completed" | "partial" | "failed" | "skipped", summary: ScrapeRunSummary) {
    void runId;
    void retailer;
    void summary;
    this.retailerStatuses.push(status);
  }

  async recordErrors(_runId: string, _retailer: RuntimeRetailer | null, errors: AdapterError[]) {
    this.errors.push(...errors);
  }

  async writeRetailerProducts(
    _runId: string,
    _retailer: RuntimeRetailer,
    products: NormalizedFilamentProduct[],
    options: Pick<ScrapeRunOptions, "dryRun" | "validateOnly">,
  ): Promise<RetailerWriteResult> {
    if (this.failWrites) throw new Error("database write failed");
    const offers = products.flatMap((product) => product.variants.map((variant) => variant.offer));
    if (!options.dryRun && !options.validateOnly) {
      for (const offer of offers) this.observations.add(offer.sourceHash);
    }
    return {
      offersSeen: offers.length,
      observationsInserted: options.dryRun || options.validateOnly ? 0 : new Set(offers.map((offer) => offer.sourceHash)).size,
    };
  }
}

async function run(repository: MemoryRepository, overrides: Partial<Parameters<typeof runDealtracker>[1]> = {}) {
  return runDealtracker(repository, {
    dryRun: false,
    validateOnly: false,
    triggerSource: "test",
    maxRuntimeMs: 30_000,
    logger: createSilentLogger(),
    ...overrides,
  });
}

test("achtergrondrun verwerkt succesvolle retailer", async () => {
  const repo = new MemoryRepository([retailer({ config: { feedText: validJoybuyFeed } })]);
  const result = await run(repo);

  assert.equal(result.status, "completed");
  assert.equal(result.exitCode, 0);
  assert.equal(result.totals.retailersSucceeded, 1);
  assert.equal(repo.observations.size, 2);
});

test("achtergrondrun wordt partial als een retailer faalt", async () => {
  const repo = new MemoryRepository([
    retailer({ config: { feedText: validJoybuyFeed } }),
    retailer({ id: "bad", adapterKey: "unknown", domain: "example.com" }),
  ]);
  const result = await run(repo);

  assert.equal(result.status, "partial");
  assert.equal(result.exitCode, 2);
  assert.equal(result.totals.retailersSucceeded, 1);
  assert.equal(result.totals.retailersFailed, 1);
});

test("achtergrondrun faalt volledig zonder werkende retailer", async () => {
  const repo = new MemoryRepository([retailer({ adapterKey: "unknown", domain: "example.com" })]);
  const result = await run(repo);

  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 1);
});

test("achtergrondrun registreert timeout voordat retailer start", async () => {
  const repo = new MemoryRepository([retailer()]);
  const result = await run(repo, { maxRuntimeMs: 0 });

  assert.equal(result.status, "failed");
  assert.equal(repo.errors[0]?.code, "run_timeout");
});

test("dubbele uitvoering krijgt duidelijke exitstatus", async () => {
  const repo = new MemoryRepository([retailer()]);
  repo.locked = true;
  const result = await run(repo);

  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 75);
});

test("mislukte databasewrite maakt retailer failed", async () => {
  const repo = new MemoryRepository([retailer()]);
  repo.failWrites = true;
  const result = await run(repo);

  assert.equal(result.status, "failed");
  assert.equal(repo.errors.some((error) => error.code === "retailer_run_failed"), true);
});

test("twee processen die tegelijk starten laten er maar een door", async () => {
  const repo = new MemoryRepository([retailer({ config: { feedText: validJoybuyFeed } })]);
  const [first, second] = await Promise.all([run(repo), run(repo)]);
  const exitCodes = [first.exitCode, second.exitCode].sort();

  assert.deepEqual(exitCodes, [0, 75]);
});

test("retailer zonder actieve adapter wordt overgeslagen en gelogd", async () => {
  const repo = new MemoryRepository([retailer({ adapterKey: "missing-adapter", domain: "missing.example" })]);
  const result = await run(repo);

  assert.equal(result.status, "failed");
  assert.equal(repo.retailerStatuses[0], "skipped");
  assert.equal(repo.errors[0]?.code, "adapter_not_found");
});

test("geen dubbele prijsmetingen binnen dezelfde run", async () => {
  const duplicateFeed = [
    "id,title,brand,link,price,shipping_price,availability",
    "dup-1,\"CAILAB PLA 1 kg - Zwart\",CaiLab,https://www.joybuy.nl/dp/dup/1,9.99 EUR,0 EUR,in stock",
    "dup-1,\"CAILAB PLA 1 kg - Zwart\",CaiLab,https://www.joybuy.nl/dp/dup/1,9.99 EUR,0 EUR,in stock",
  ].join("\n");
  const repo = new MemoryRepository([retailer({ config: { feedText: duplicateFeed as JsonValue } })]);
  const result = await run(repo);

  assert.equal(result.status, "completed");
  assert.equal(result.totals.offersSeen, 1);
  assert.equal(repo.observations.size, 1);
});
