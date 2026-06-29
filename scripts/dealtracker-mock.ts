import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { MockRetailerAdapter } from "../src/services/dealtracker/adapters/MockRetailerAdapter.ts";
import { createStructuredLogger } from "../src/services/dealtracker/logger.ts";
import { runRetailerAdapter } from "../src/services/dealtracker/runAdapter.ts";

const dryRun = process.argv.includes("--dry-run");
const fixtureArg = process.argv.find((arg) => arg.startsWith("--fixture="));
const fixturePath = fixtureArg
  ? resolve(fixtureArg.slice("--fixture=".length))
  : resolve("tests/fixtures/dealtracker/mock-products.json");

const fixtureSource = await readFile(fixturePath, "utf8");
const result = await runRetailerAdapter(new MockRetailerAdapter(fixtureSource), {
  dryRun,
  logger: createStructuredLogger({ command: "dealtracker:mock" }),
});

console.info(JSON.stringify({
  dryRun,
  fixture: pathToFileURL(fixturePath).href,
  summary: result.summary,
  errors: result.errors,
}, null, 2));
