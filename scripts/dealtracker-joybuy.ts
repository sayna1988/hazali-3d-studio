import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { JoybuyAdapter } from "../src/services/dealtracker/adapters/JoybuyAdapter.ts";
import { createStructuredLogger } from "../src/services/dealtracker/logger.ts";
import { runRetailerAdapter } from "../src/services/dealtracker/runAdapter.ts";

const dryRun = process.argv.includes("--dry-run") || !process.argv.includes("--write");
const fixtureArg = process.argv.find((arg) => arg.startsWith("--fixture="));
const feedArg = process.argv.find((arg) => arg.startsWith("--feed-url="));
const fixturePath = fixtureArg
  ? resolve(fixtureArg.slice("--fixture=".length))
  : resolve("tests/fixtures/dealtracker/joybuy-awin-feed.csv");

const adapter = feedArg
  ? new JoybuyAdapter({ feedUrl: feedArg.slice("--feed-url=".length) })
  : new JoybuyAdapter({ feedText: await readFile(fixturePath, "utf8") });

const result = await runRetailerAdapter(adapter, {
  dryRun,
  logger: createStructuredLogger({ command: "dealtracker:joybuy" }),
  maxConcurrency: 2,
});

console.info(JSON.stringify({
  dryRun,
  source: feedArg ? "configured-feed-url" : pathToFileURL(fixturePath).href,
  summary: result.summary,
  acceptedProducts: result.products.map((product) => ({
    sourceId: product.sourceId,
    name: product.productName,
    variants: product.variants.length,
    unknownShipping: product.variants.filter((variant) => !variant.offer.shippingCostKnown).length,
  })),
  rejectedProducts: result.errors.map((error) => ({
    sourceId: error.sourceId,
    stage: error.stage,
    code: error.code,
    message: error.message,
  })),
}, null, 2));
