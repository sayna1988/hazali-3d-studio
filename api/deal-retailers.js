import { createClient } from "@supabase/supabase-js";

const SUPPORTED_ADAPTERS = new Map([
  ["joybuy-nl", { adapterType: "affiliate_feed", defaultName: "Joybuy", defaultDomain: "www.joybuy.nl" }],
]);

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function bearerToken(request) {
  const header = first(request.headers.authorization);
  return typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function bodyRecord(body) {
  return body && typeof body === "object" && !Array.isArray(body) ? body : {};
}

function normalizeDomain(value) {
  const trimmed = String(value || "").trim().toLowerCase();
  if (!trimmed) return "";
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).hostname;
  } catch {
    return "";
  }
}

function isSafeExternalUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (!["https:", "http:"].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost")) return false;
    if (/^(10|127|169\.254|0)\./.test(host)) return false;
    if (/^192\.168\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function cleanRetailer(input) {
  const record = bodyRecord(input);
  const adapterKey = String(record.adapterKey || "joybuy-nl").trim();
  const supported = SUPPORTED_ADAPTERS.get(adapterKey);
  if (!supported) throw new Error("Deze adapter wordt nog niet ondersteund.");

  const domain = normalizeDomain(record.domain || supported.defaultDomain);
  if (!domain) throw new Error("Vul een geldig domein in.");

  const feedUrl = String(record.feedUrl || "").trim();
  if (!isSafeExternalUrl(feedUrl)) throw new Error("Vul een geldige externe feed-URL in.");

  return {
    name: String(record.name || supported.defaultName).trim() || supported.defaultName,
    domain,
    country_code: "NL",
    active: Boolean(record.active),
    adapter_type: supported.adapterType,
    adapter_key: adapterKey,
    config: { feedUrl },
    request_delay_ms: 1000,
    request_timeout_ms: 15000,
    max_concurrency: 3,
  };
}

async function authenticatedServiceClient(request) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase servicecontext ontbreekt.");

  const token = bearerToken(request);
  if (!token) {
    const error = new Error("Log in om retailers te beheren.");
    error.statusCode = 401;
    throw error;
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    const authError = new Error("Ongeldige sessie.");
    authError.statusCode = 401;
    throw authError;
  }
  return client;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Methode niet toegestaan." });
  }

  try {
    const client = await authenticatedServiceClient(request);
    const body = bodyRecord(request.body);

    if (body.action === "create") {
      const retailer = cleanRetailer(body.retailer);
      const { data: existing, error: readError } = await client
        .from("deal_retailers")
        .select("id")
        .eq("domain", retailer.domain)
        .maybeSingle();
      if (readError) throw readError;

      const query = existing?.id
        ? client.from("deal_retailers").update(retailer).eq("id", existing.id)
        : client.from("deal_retailers").insert(retailer);
      const { error } = await query;
      if (error) throw error;
      return response.status(200).json({ ok: true });
    }

    if (body.action === "setActive") {
      const id = String(body.id || "");
      if (!id) return response.status(400).json({ error: "Retailer-id ontbreekt." });
      const { error } = await client
        .from("deal_retailers")
        .update({ active: Boolean(body.active) })
        .eq("id", id);
      if (error) throw error;
      return response.status(200).json({ ok: true });
    }

    return response.status(400).json({ error: "Onbekende retaileractie." });
  } catch (error) {
    const status = typeof error?.statusCode === "number" ? error.statusCode : 500;
    return response.status(status).json({
      error: error instanceof Error ? error.message : "Retailerbeheer is mislukt.",
    });
  }
}
