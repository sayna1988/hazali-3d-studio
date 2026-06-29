import { createClient } from "@supabase/supabase-js";
import { SupabaseDealtrackerRepository } from "../src/services/dealtracker/SupabaseDealtrackerRepository.ts";
import { evaluateDealAlerts } from "../src/services/dealtracker/alertEvaluator.ts";
import { createStructuredLogger } from "../src/services/dealtracker/logger.ts";
import { runDealtracker } from "../src/services/dealtracker/scrapeOrchestrator.ts";

function argValue(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function numberArg(name: string, fallback: number) {
  const value = Number.parseInt(argValue(name) ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Vereist: SUPABASE_URL of VITE_SUPABASE_URL, plus SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(78);
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const result = await runDealtracker(new SupabaseDealtrackerRepository(client), {
  dryRun: hasFlag("dry-run"),
  validateOnly: hasFlag("validate-only"),
  retailerFilter: argValue("retailer"),
  maxProducts: argValue("max-products") ? numberArg("max-products", 0) : undefined,
  maxRuntimeMs: numberArg("max-runtime-ms", 240_000),
  triggerSource: "local",
  logger: createStructuredLogger({ command: "dealtracker:run" }),
});

const appBaseUrl = process.env.HAZALI_APP_URL || "http://localhost:5173";
const alertResult = (!hasFlag("dry-run") && !hasFlag("validate-only"))
  ? await evaluateDealAlerts(client, result.runId, appBaseUrl)
  : null;

console.info(JSON.stringify({ ...result, alertResult }, null, 2));
process.exitCode = result.exitCode;
