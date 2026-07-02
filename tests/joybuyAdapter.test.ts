import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";
import test from "node:test";
import { JoybuyAdapter, joybuyInternalsForTests } from "../src/services/dealtracker/adapters/JoybuyAdapter.ts";
import { createSilentLogger } from "../src/services/dealtracker/logger.ts";
import { runRetailerAdapter } from "../src/services/dealtracker/runAdapter.ts";

const fixturePath = resolve("tests/fixtures/dealtracker/joybuy-awin-feed.csv");

async function fixtureText() {
  return readFile(fixturePath, "utf8");
}

test("Joybuy parser leest PLA en PLA+ feedregels, maar geen PETG", async () => {
  const adapter = new JoybuyAdapter({ feedText: await fixtureText() });
  const source = await adapter.fetchProductOverview({
    now: new Date("2026-06-30T00:00:00.000Z"),
    dryRun: true,
    logger: createSilentLogger(),
    http: {
      fetchText: async () => "",
      fetchJson: async () => ({}),
    },
  });
  const rows = await adapter.parseProductOverview(source, {
    now: new Date("2026-06-30T00:00:00.000Z"),
    dryRun: true,
    logger: createSilentLogger(),
    http: {
      fetchText: async () => "",
      fetchJson: async () => ({}),
    },
  });

  assert.equal(rows.length, 6);
  assert.equal(rows.some((row) => row.sourceId === "20000005"), false);
});

test("Joybuy normaliseert varianten, korting, multipack en onbekende verzending", async () => {
  const result = await runRetailerAdapter(new JoybuyAdapter({ feedText: await fixtureText() }), {
    dryRun: true,
    now: new Date("2026-06-30T00:00:00.000Z"),
    logger: createSilentLogger(),
  });

  const bronze = result.products.find((product) => product.sourceId === "10323408")?.variants[0];
  assert.equal(bronze?.color, "Brons");
  assert.equal(bronze?.spoolWeightGrams, 1000);
  assert.equal(bronze?.offer.directDiscountCents, 100);
  assert.equal(bronze?.offer.shippingCostKnown, false);

  const multipack = result.products.find((product) => product.sourceId === "20000001")?.variants[0];
  assert.equal(multipack?.spoolCount, 4);
  assert.equal(multipack?.spoolWeightGrams, 250);
  assert.equal(multipack?.totalWeightGrams, 1000);
  assert.equal(multipack?.offer.shippingCostKnown, true);
  assert.equal(multipack?.offer.pricePerKgCents, 2295);
});

test("Joybuy markeert uitverkochte producten", async () => {
  const result = await runRetailerAdapter(new JoybuyAdapter({ feedText: await fixtureText() }), {
    dryRun: true,
    now: new Date("2026-06-30T00:00:00.000Z"),
    logger: createSilentLogger(),
  });
  const soldOut = result.products.find((product) => product.sourceId === "20000002")?.variants[0];

  assert.equal(soldOut?.offer.stockStatus, "out_of_stock");
});

test("Joybuy wijst ongeldige prijzen en producten zonder betrouwbaar gewicht af", async () => {
  const result = await runRetailerAdapter(new JoybuyAdapter({ feedText: await fixtureText() }), {
    dryRun: true,
    now: new Date("2026-06-30T00:00:00.000Z"),
    logger: createSilentLogger(),
  });

  assert.equal(result.summary.productsSeen, 6);
  assert.equal(result.summary.productsNormalized, 4);
  assert.equal(result.summary.productErrors, 2);
  assert.deepEqual(result.errors.map((error) => error.sourceId), ["20000003", "20000004"]);
});

test("Joybuy parser verdraagt gewijzigde kolomvolgorde", async () => {
  const text = [
    "price,link,title,brand,id,availability,shipping_price",
    "8.99 EUR,https://www.joybuy.nl/dp/example/1,\"CAILAB PLA+ Bio - Cyaan 1 kg\",CaiLab,alt-1,in stock,0 EUR",
  ].join("\n");
  const result = await runRetailerAdapter(new JoybuyAdapter({ feedText: text }), {
    dryRun: true,
    now: new Date("2026-06-30T00:00:00.000Z"),
    logger: createSilentLogger(),
  });

  assert.equal(result.summary.productsNormalized, 1);
  assert.equal(result.products[0]?.material, "PLA+");
});

test("Joybuy internals parsen geld en gewicht defensief", () => {
  assert.equal(joybuyInternalsForTests.parseMoneyCents("€ 8,99"), 899);
  assert.equal(joybuyInternalsForTests.parseMoneyCents("ongeldig"), null);
  assert.equal(joybuyInternalsForTests.parseWeightGrams("4 x 250 g"), 1000);
  assert.equal(joybuyInternalsForTests.parseSpoolCount("4 x 250 g"), 4);
});
