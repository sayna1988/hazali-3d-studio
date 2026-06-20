const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function bearerToken(request) {
  const header = String(request.headers.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function validStatus(value) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    JSON.stringify(value).length <= 32_000;
}

async function supabaseRequest(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Alleen POST is toegestaan." });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return response.status(503).json({ error: "Printerrelay is niet geconfigureerd." });
  }

  const token = bearerToken(request);
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return response.status(401).json({ error: "Ongeldige printertoken." });
  }
  if (!validStatus(request.body)) {
    return response.status(400).json({ error: "Ongeldige of te grote statuspayload." });
  }

  const deviceResult = await supabaseRequest(
    `printer_devices?select=user_id&ingest_token=eq.${encodeURIComponent(token)}&limit=1`,
  );
  if (!deviceResult.ok) return response.status(502).json({ error: "Cloudverbinding mislukt." });
  const [device] = await deviceResult.json();
  if (!device) return response.status(401).json({ error: "Onbekende printertoken." });

  const result = await supabaseRequest("printer_status?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: device.user_id,
      data: request.body,
      received_at: new Date().toISOString(),
    }),
  });
  if (!result.ok) return response.status(502).json({ error: "Status opslaan mislukt." });
  return response.status(202).json({ accepted: true });
}
