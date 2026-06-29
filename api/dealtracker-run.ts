import { createClient } from "@supabase/supabase-js";
import { SupabaseDealtrackerRepository } from "../src/services/dealtracker/SupabaseDealtrackerRepository.ts";
import { evaluateDealAlerts } from "../src/services/dealtracker/alertEvaluator.ts";
import { createStructuredLogger } from "../src/services/dealtracker/logger.ts";
import { runDealtracker } from "../src/services/dealtracker/scrapeOrchestrator.ts";

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => { json: (body: unknown) => void };
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function bodyRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
}

function booleanValue(value: unknown) {
  return value === true || value === "true" || value === "1";
}

function numberValue(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function bearerToken(request: ApiRequest) {
  const header = first(request.headers.authorization);
  return header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function isAuthorized(request: ApiRequest) {
  const expected = process.env.DEALTRACKER_RUN_SECRET || process.env.CRON_SECRET;
  if (!expected) return false;
  const headerSecret = first(request.headers["x-dealtracker-secret"]);
  return bearerToken(request) === expected || headerSecret === expected;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(request.method ?? "")) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Methode niet toegestaan." });
  }
  if (!isAuthorized(request)) return response.status(401).json({ error: "Ongeldige dealtracker-secret." });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return response.status(503).json({ error: "Supabase servicecontext ontbreekt." });
  }

  const body = bodyRecord(request.body);
  const retailer = first(request.query.retailer) ?? (typeof body.retailer === "string" ? body.retailer : undefined);
  const dryRun = booleanValue(first(request.query.dryRun) ?? body.dryRun);
  const validateOnly = booleanValue(first(request.query.validateOnly) ?? body.validateOnly);
  const maxProducts = numberValue(first(request.query.maxProducts) ?? body.maxProducts, 0) || undefined;
  const maxRuntimeMs = numberValue(first(request.query.maxRuntimeMs) ?? body.maxRuntimeMs, 240_000);

  try {
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const result = await runDealtracker(new SupabaseDealtrackerRepository(client), {
      dryRun,
      validateOnly,
      retailerFilter: retailer,
      maxProducts,
      maxRuntimeMs,
      triggerSource: "api",
      logger: createStructuredLogger({ endpoint: "api/dealtracker-run" }),
    });
    const appBaseUrl = process.env.HAZALI_APP_URL || first(request.headers.origin) || "";
    const alertResult = (!dryRun && !validateOnly && appBaseUrl)
      ? await evaluateDealAlerts(client, result.runId, appBaseUrl)
      : null;

    return response.status(result.exitCode === 0 ? 200 : result.exitCode === 2 ? 207 : 500).json({ ...result, alertResult });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : "Dealtracker-run mislukt.",
    });
  }
}
