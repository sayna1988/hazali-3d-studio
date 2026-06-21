const MAX_DATA_URL_LENGTH = 4_300_000;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

const filamentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["supplier", "invoiceNumber", "invoiceDate", "currency", "filaments", "warnings"],
  properties: {
    supplier: { type: "string" },
    invoiceNumber: { type: "string" },
    invoiceDate: { type: "string" },
    currency: { type: "string" },
    filaments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "brand", "material", "color", "quantity", "gramsPerSpool", "pricePerSpool", "pricePerKg", "lineTotal", "confidence", "notes"],
        properties: {
          name: { type: "string" },
          brand: { type: "string" },
          material: { type: "string", enum: ["PLA", "PETG", "ABS", "TPU", "ASA", "PA", "PC"] },
          color: { type: "string" },
          quantity: { type: "number" },
          gramsPerSpool: { type: "number" },
          pricePerSpool: { type: "number" },
          pricePerKg: { type: "number" },
          lineTotal: { type: "number" },
          confidence: { type: "number" },
          notes: { type: "string" },
        },
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
};

async function verifyUser(request) {
  const token = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return true;
  if (!token) return false;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  return response.ok;
}

function outputText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const output of data?.output || []) {
    for (const content of output?.content || []) {
      if (content?.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Alleen POST is toegestaan." });
  }
  if (!await verifyUser(request)) return response.status(401).json({ error: "Log opnieuw in om een factuur te importeren." });
  if (!process.env.OPENAI_API_KEY) return response.status(503).json({ error: "Factuurherkenning is nog niet geconfigureerd (OPENAI_API_KEY ontbreekt)." });

  const { filename, mimeType, dataUrl } = request.body || {};
  if (!ALLOWED_MIME_TYPES.has(mimeType) || typeof dataUrl !== "string" || !dataUrl.startsWith(`data:${mimeType};base64,`)) {
    return response.status(400).json({ error: "Ongeldig factuurbestand." });
  }
  if (dataUrl.length > MAX_DATA_URL_LENGTH) return response.status(413).json({ error: "Het factuurbestand is te groot." });

  const fileContent = mimeType === "application/pdf"
    ? { type: "input_file", filename: String(filename || "factuur.pdf"), file_data: dataUrl }
    : { type: "input_image", image_url: dataUrl, detail: "high" };
  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_INVOICE_MODEL || "gpt-5.4",
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Lees deze aankoopfactuur en extraheer uitsluitend aangekochte 3D-printerfilamenten. Negeer vracht, accessoires en andere producten. Splits verschillende kleuren in aparte regels, ook als ze onder één productomschrijving staan. Gebruik prijzen inclusief btw als die beschikbaar zijn. quantity is het aantal rollen, gramsPerSpool het nettogewicht van één rol. pricePerSpool is de werkelijk betaalde prijs per rol na korting; lineTotal is het betaalde totaal voor die regel. Bereken pricePerKg als pricePerSpool / (gramsPerSpool / 1000). Als gewicht ontbreekt, gebruik 1000 en meld dit in notes en warnings. Als kleur onbekend is, gebruik Onbekend. Als merk ontbreekt, leid het voorzichtig af uit productnaam of leverancier; anders Onbekend. Gebruik een korte herkenbare name zonder merk, kleur of gewicht. confidence is 0 tot 1. invoiceDate in YYYY-MM-DD indien herkenbaar. Gebruik lege strings voor ontbrekende factuurmetadata.`,
          },
          fileContent,
        ],
      }],
      text: { format: { type: "json_schema", name: "invoice_filaments", strict: true, schema: filamentSchema } },
    }),
  });
  const result = await openAiResponse.json().catch(() => null);
  if (!openAiResponse.ok) {
    console.error("OpenAI invoice error", openAiResponse.status, result?.error?.message);
    return response.status(502).json({ error: "De documentanalyse is mislukt. Probeer het opnieuw of gebruik een scherpere scan." });
  }
  try {
    const parsed = JSON.parse(outputText(result));
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json(parsed);
  } catch (error) {
    console.error("Invoice output parse error", error);
    return response.status(502).json({ error: "De herkende factuurgegevens konden niet worden verwerkt." });
  }
}
