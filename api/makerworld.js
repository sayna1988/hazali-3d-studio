const MAKERWORLD_ORIGIN = "https://makerworld.com";

const API_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
  Origin: MAKERWORLD_ORIGIN,
  "Sec-Ch-Ua": '"Google Chrome";v="149", "Chromium";v="149", "Not(A:Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
  "X-BBL-App-Source": "makerworld",
  "X-BBL-Client-Name": "MakerWorld",
  "X-BBL-Client-Type": "web",
  "X-BBL-Client-Version": "00.00.00.01",
};

function apiHeaders(referer) {
  const headers = { ...API_HEADERS, Referer: referer || MAKERWORLD_ORIGIN };
  const encodedCookie = process.env.MAKERWORLD_COOKIE_BASE64?.trim();
  const decodedCookie = encodedCookie
    ? Buffer.from(encodedCookie, "base64").toString("utf8").trim()
    : "";
  const cookie = process.env.MAKERWORLD_COOKIE?.trim() || decodedCookie;
  const token = process.env.MAKERWORLD_SESSION_TOKEN?.trim();
  if (cookie) headers.Cookie = cookie;
  else if (token) headers.Cookie = `token=${token}`;
  return headers;
}

function modelIdFromUrl(value) {
  try {
    const url = new URL(value);
    if (!['makerworld.com', 'www.makerworld.com'].includes(url.hostname.toLowerCase())) return null;
    return url.pathname.match(/\/models\/(\d+)(?:-|\/|$)/)?.[1] || null;
  } catch {
    return null;
  }
}

async function makerWorldJson(path, referer) {
  const response = await fetch(`${MAKERWORLD_ORIGIN}${path}`, {
    headers: apiHeaders(referer),
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const error = new Error(response.status === 401 || response.status === 403
      ? "MakerWorld staat downloads alleen met een geldige ingelogde sessie toe. Werk de MakerWorld-cookie in Vercel bij."
      : `MakerWorld antwoordde met status ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function imageUrl(value) {
  if (typeof value === "string") return value.startsWith("//") ? `https:${value}` : value;
  if (!value || typeof value !== "object") return "";
  const url = value.url || value.originUrl || value.imageUrl || value.thumbnail || "";
  return typeof url === "string" && url.startsWith("//") ? `https:${url}` : url;
}

function collectImages(model) {
  const candidates = [
    ...(model.designExtension?.design_pictures || []),
    ...(model.pictures || []),
    ...(model.instances || []).flatMap((instance) => [...(instance.pictures || []), instance.cover]),
    model.cover,
    model.thumbnail,
  ];
  return [...new Set(candidates.map(imageUrl).filter((value) => /^https:\/\//i.test(value)))].slice(0, 20);
}

function collectTags(model) {
  return [...new Set((model.tags || []).map((tag) => {
    if (typeof tag === "string") return tag.trim();
    return String(tag?.name || tag?.title || tag?.tag || tag?.tagName || "").trim();
  }).filter(Boolean))].slice(0, 20);
}

function defaultInstance(model) {
  const instances = Array.isArray(model.instances) ? model.instances : [];
  const preferredId = String(model.defaultInstanceId || model.default_instance_id || "");
  return instances.find((instance) => String(instance.id) === preferredId) || instances[0] || null;
}

function secondsFromDuration(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value !== "string") return 0;

  const trimmed = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed));

  const hours = Number(trimmed.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hour|uur)/i)?.[1] || 0);
  const minutes = Number(trimmed.match(/(\d+(?:\.\d+)?)\s*(?:m|min|minute)/i)?.[1] || 0);
  const seconds = Number(trimmed.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|second)/i)?.[1] || 0);
  return Math.round(hours * 3600 + minutes * 60 + seconds);
}

function printTimeSeconds(...sources) {
  const preferredKeys = /^(prediction|print_?time|printing_?time|estimated_?print_?time|duration|total_?time)$/i;
  const seen = new Set();

  function find(value, depth = 0) {
    if (!value || typeof value !== "object" || depth > 5 || seen.has(value)) return 0;
    seen.add(value);

    for (const [key, candidate] of Object.entries(value)) {
      if (preferredKeys.test(key)) {
        const seconds = secondsFromDuration(candidate);
        if (seconds > 0) return seconds;
      }
    }

    for (const candidate of Object.values(value)) {
      if (candidate && typeof candidate === "object") {
        const seconds = find(candidate, depth + 1);
        if (seconds > 0) return seconds;
      }
    }
    return 0;
  }

  for (const source of sources) {
    const seconds = find(source);
    if (seconds > 0) return seconds;
  }
  return 0;
}

async function downloadDescriptor(instanceId, referer, modelId) {
  const paths = [
    `/api/v1/design-service/instance/${encodeURIComponent(instanceId)}/f3mf?type=download&fileType=`,
    `/api/v1/design-service/instance/${encodeURIComponent(instanceId)}/f3mf?type=download&fileType=3mfstl`,
  ];
  if (modelId) paths.push(`/api/v1/design-service/design/${encodeURIComponent(modelId)}/model?modelType=all&type=download`);
  let lastError;
  for (const path of paths) {
    try { return await makerWorldJson(path, referer); } catch (error) { lastError = error; }
  }
  throw lastError;
}

export default async function handler(request, response) {
  if (request.method === "POST") {
    const sourceUrl = String(request.body?.url || "").trim();
    const modelId = modelIdFromUrl(sourceUrl);
    if (!modelId) return response.status(400).json({ error: "Plak een geldige MakerWorld-model-URL." });

    try {
      const canonicalUrl = `${MAKERWORLD_ORIGIN}/models/${modelId}`;
      const model = await makerWorldJson(`/api/v1/design-service/design/${modelId}`, canonicalUrl);
      const instance = defaultInstance(model);
      if (!instance?.id) return response.status(422).json({ error: "Dit model heeft geen downloadbaar 3MF-printprofiel." });
      const download = await downloadDescriptor(instance.id, canonicalUrl, modelId);
      const downloadUrl = download?.url || download?.data?.url;
      if (!/^https:\/\//i.test(downloadUrl || "")) {
        return response.status(422).json({ error: "MakerWorld gaf geen bruikbare 3MF-download terug." });
      }

      response.setHeader("Cache-Control", "private, no-store");
      return response.status(200).json({
        modelId,
        sourceUrl: canonicalUrl,
        title: model.title || instance.title || `MakerWorld model ${modelId}`,
        summary: model.summary || instance.summary || "",
        tags: collectTags(model),
        images: collectImages(model),
        printTimeSeconds: printTimeSeconds(instance, download, model),
        download: {
          url: downloadUrl,
          name: download.name || download?.data?.name || `${model.title || `makerworld-${modelId}`}.3mf`,
          instanceId: String(instance.id),
        },
      });
    } catch (error) {
      const status = Number(error?.status) || 502;
      return response.status(status >= 400 && status < 500 ? status : 502).json({
        error: error instanceof Error ? error.message : "MakerWorld-import is mislukt.",
      });
    }
  }

  if (request.method === "GET") {
    const modelId = String(request.query.modelId || "");
    const instanceId = String(request.query.instanceId || "");
    if (!/^\d+$/.test(modelId) || !/^\d+$/.test(instanceId)) {
      return response.status(400).json({ error: "Ongeldige MakerWorld-download." });
    }
    try {
      const referer = `${MAKERWORLD_ORIGIN}/models/${modelId}`;
      const descriptor = await downloadDescriptor(instanceId, referer);
      const downloadUrl = descriptor?.url || descriptor?.data?.url;
      if (!/^https:\/\//i.test(downloadUrl || "")) throw new Error("Geen download-URL ontvangen.");
      const fileResponse = await fetch(downloadUrl, { redirect: "follow", signal: AbortSignal.timeout(30000) });
      if (!fileResponse.ok) throw new Error(`3MF-download antwoordde met status ${fileResponse.status}.`);
      const bytes = Buffer.from(await fileResponse.arrayBuffer());
      response.setHeader("Content-Type", "application/vnd.ms-package.3dmanufacturing-3dmodel+xml");
      response.setHeader("Content-Disposition", `attachment; filename="makerworld-${modelId}.3mf"`);
      response.setHeader("Cache-Control", "private, no-store");
      return response.status(200).send(bytes);
    } catch (error) {
      return response.status(502).json({ error: error instanceof Error ? error.message : "3MF downloaden is mislukt." });
    }
  }

  response.setHeader("Allow", "GET, POST");
  return response.status(405).json({ error: "Methode niet toegestaan." });
}
