import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";
import test from "node:test";
import { MockRetailerAdapter } from "../src/services/dealtracker/adapters/MockRetailerAdapter.ts";
import { createDealHttpClient, validatePublicHttpUrl } from "../src/services/dealtracker/httpClient.ts";
import { createSilentLogger } from "../src/services/dealtracker/logger.ts";
import { runRetailerAdapter } from "../src/services/dealtracker/runAdapter.ts";

const fixturePath = resolve("tests/fixtures/dealtracker/mock-products.json");

async function mockAdapter() {
  return new MockRetailerAdapter(await readFile(fixturePath, "utf8"));
}

function context() {
  return {
    now: new Date("2026-06-30T00:00:00.000Z"),
    dryRun: true,
    http: createDealHttpClient({
      fetchFn: async () => new Response("{}", { headers: { "content-type": "application/json" } }),
    }),
    logger: createSilentLogger(),
  };
}

test("mockadapter parseert lokale fixture zonder internet", async () => {
  const adapter = await mockAdapter();
  const source = await adapter.fetchProductOverview(context());
  const products = await adapter.parseProductOverview(source, context());

  assert.equal(products.length, 8);
  assert.equal(products[0]?.sourceId, "pla-basic-1kg");
});

test("mockadapter normaliseert standaardrol en kleurvarianten", async () => {
  const adapter = await mockAdapter();
  const source = await adapter.fetchProductOverview(context());
  const products = await adapter.parseProductOverview(source, context());
  const normalized = await adapter.normalizeProduct(products[0]!, context());

  assert.equal(normalized.productName, "Hazali PLA Basic 1 kg");
  assert.equal(normalized.material, "PLA");
  assert.equal(normalized.variants.length, 2);
  assert.deepEqual(normalized.variants.map((variant) => variant.color), ["Zwart", "Wit"]);
  assert.equal(normalized.variants[0]?.offer.pricePerKgCents, 1999);
});

test("een foutief product stopt de rest van de run niet", async () => {
  const result = await runRetailerAdapter(await mockAdapter(), {
    dryRun: true,
    now: new Date("2026-06-30T00:00:00.000Z"),
    logger: createSilentLogger(),
  });

  assert.equal(result.summary.productsSeen, 8);
  assert.equal(result.summary.productsNormalized, 6);
  assert.equal(result.summary.productErrors, 2);
  assert.equal(result.products.some((product) => product.sourceId === "pla-shipping"), true);
});

test("dubbele aanbiedingen komen maar eenmaal in het resultaat", async () => {
  const result = await runRetailerAdapter(await mockAdapter(), {
    dryRun: true,
    now: new Date("2026-06-30T00:00:00.000Z"),
    logger: createSilentLogger(),
  });
  const duplicateProduct = result.products.find((product) => product.sourceId === "pla-duplicate");

  assert.equal(duplicateProduct?.variants.length, 1);
  assert.equal(result.summary.duplicateOffersSkipped, 1);
});

test("HTTP-client doet beperkte retries met exponential backoff", async () => {
  const waits: number[] = [];
  let calls = 0;
  const client = createDealHttpClient({
    retries: 2,
    retryBaseDelayMs: 10,
    sleep: async (ms) => { waits.push(ms); },
    fetchFn: async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("{}", {
          status: 503,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const result = await client.fetchJson("https://example.com/feed.json");

  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 2);
  assert.deepEqual(waits, [10]);
});

test("HTTP-client handelt timeouts af met fetch mock", async () => {
  const client = createDealHttpClient({
    retries: 0,
    timeoutMs: 1,
    fetchFn: (_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }),
  });

  await assert.rejects(() => client.fetchText("https://example.com/slow.html"), /aborted/);
});

test("HTTP-client blokkeert onveilige interne URLs", () => {
  assert.throws(() => validatePublicHttpUrl("http://127.0.0.1/feed.json"), /Interne/);
  assert.throws(() => validatePublicHttpUrl("file:///tmp/feed.json"), /protocol/);
});

test("HTTP-client valideert content-type en responsegrootte", async () => {
  const wrongTypeClient = createDealHttpClient({
    retries: 0,
    fetchFn: async () => new Response("ok", { headers: { "content-type": "text/plain" } }),
  });
  await assert.rejects(() => wrongTypeClient.fetchJson("https://example.com/feed.txt"), /content-type/);

  const oversizedClient = createDealHttpClient({
    retries: 0,
    maxResponseBytes: 2,
    fetchFn: async () => new Response("te groot", { headers: { "content-type": "text/html" } }),
  });
  await assert.rejects(() => oversizedClient.fetchText("https://example.com/feed.html"), /groter/);
});
