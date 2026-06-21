import dns from "node:dns/promises";
import net from "node:net";

const PRODUCT_DATABASES = [
  { name: "Open Products Facts", url: "https://world.openproductsfacts.org" },
  { name: "Open Food Facts", url: "https://world.openfoodfacts.org" },
];

function isValidEan(code) {
  if (!/^\d{8}$|^\d{13}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const checkDigit = digits.pop();
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === checkDigit;
}

async function fetchText(url, timeout = 7000) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/json",
      "User-Agent": "Mozilla/5.0 (compatible; Hazali3DStudio/1.0; +https://www.hazali.nl)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) return null;
  return response.text();
}

async function fetchJson(url) {
  const text = await fetchText(url);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function productCandidate(product, source, url = "") {
  const name = product?.product_name || product?.product_name_en || product?.generic_name || product?.title;
  if (!name) return null;
  return {
    kind: "product",
    title: name,
    source,
    url,
    product: {
      name,
      brand: product.brands?.split?.(",")[0]?.trim() || product.brand || "Onbekend merk",
      description: product.generic_name || product.description || product.categories || "",
      category: product.categories || product.category || "",
      image: product.image_front_url || product.images?.[0] || product.image || "",
      source,
      price: Number(product.lowest_recorded_price || product.offers?.price) || undefined,
    },
  };
}

async function lookupOpenFacts(database, code) {
  const fields = "code,product_name,product_name_en,generic_name,brands,categories,image_front_url";
  const data = await fetchJson(`${database.url}/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`);
  if (data?.status !== 1) return null;
  return productCandidate(data.product, database.name, `${database.url}/product/${code}`);
}

async function lookupUpcItemDb(code) {
  const data = await fetchJson(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`);
  return productCandidate(data?.items?.[0], "UPCitemdb");
}

async function lookupWikidata(code) {
  const query = `SELECT ?item ?itemLabel ?manufacturerLabel WHERE {
    ?item wdt:P3962 "${code}".
    OPTIONAL { ?item wdt:P176 ?manufacturer. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "nl,en". }
  } LIMIT 1`;
  const data = await fetchJson(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`);
  const result = data?.results?.bindings?.[0];
  const name = result?.itemLabel?.value;
  if (!name || name === result?.item?.value) return null;
  return productCandidate({ title: name, brand: result.manufacturerLabel?.value }, "Wikidata", result.item?.value);
}

function decodeHtml(value = "") {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

async function searchWeb(code) {
  const results = [];
  const query = `"${code}"`;
  const [mojeek, duck] = await Promise.allSettled([
    fetchText(`https://www.mojeek.com/search?q=${encodeURIComponent(query)}`),
    fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`),
  ]);

  const mojeekHtml = mojeek.status === "fulfilled" ? mojeek.value : null;
  if (mojeekHtml) {
    for (const match of mojeekHtml.matchAll(/<h2><a[^>]+class="title"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2><p class="s">([\s\S]*?)<\/p>/gi)) {
      try {
        const url = decodeHtml(match[1]);
        const parsed = new URL(url);
        if (!/^https?:$/.test(parsed.protocol)) continue;
        const title = decodeHtml(match[2]);
        const snippet = decodeHtml(match[3]);
        if (![url, title, snippet].some((value) => value.includes(code))) continue;
        results.push({ kind: "web", title, source: parsed.hostname.replace(/^www\./, ""), url, snippet });
      } catch { continue; }
      if (results.length === 6) break;
    }
  }

  const html = duck.status === "fulfilled" ? duck.value : null;
  if (html && results.length < 6) {
    const pattern = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>)?/gi;
    for (const match of html.matchAll(pattern)) {
      try {
        const raw = decodeHtml(match[1]);
        const redirect = new URL(raw, "https://html.duckduckgo.com");
        const url = redirect.searchParams.get("uddg") || redirect.href;
        const parsed = new URL(url);
        if (!/^https?:$/.test(parsed.protocol) || parsed.hostname.includes("duckduckgo.com")) continue;
        results.push({ kind: "web", title: decodeHtml(match[2]), source: parsed.hostname.replace(/^www\./, ""), url, snippet: decodeHtml(match[3]) });
      } catch { continue; }
      if (results.length === 6) break;
    }
  }
  return [...new Map(results.map((result) => [result.url, result])).values()];
}

function isPrivateIp(address) {
  if (address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return false;
}

async function safePublicUrl(value) {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error("Ongeldige productlink.");
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) throw new Error("Deze productlink kan niet worden opgehaald.");
  return url;
}

function firstMeta(html, names) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeHtml(match[1]);
    }
  }
  return "";
}

function findProductJson(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) { const found = findProductJson(item); if (found) return found; }
    return null;
  }
  const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
  if (types.some((type) => String(type).toLowerCase() === "product")) return value;
  return findProductJson(value["@graph"]);
}

async function scrapeProduct(value) {
  const url = await safePublicUrl(value);
  const html = await fetchText(url.href, 9000);
  if (!html) throw new Error("Deze productpagina kon niet worden gelezen.");
  let structured = null;
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { structured = findProductJson(JSON.parse(match[1])); } catch { /* ongeldige JSON-LD overslaan */ }
    if (structured) break;
  }
  const brand = typeof structured?.brand === "string" ? structured.brand : structured?.brand?.name;
  const image = Array.isArray(structured?.image) ? structured.image[0] : structured?.image;
  const name = structured?.name || firstMeta(html, ["og:title", "twitter:title"]) || decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  if (!name) throw new Error("Op deze pagina zijn geen herkenbare productgegevens gevonden.");
  return {
    name,
    brand: brand || firstMeta(html, ["product:brand", "og:site_name"]) || "Onbekend merk",
    description: structured?.description || firstMeta(html, ["og:description", "description"]),
    category: structured?.category || "",
    image: image || firstMeta(html, ["og:image", "twitter:image"]),
    source: url.hostname.replace(/^www\./, ""),
    price: Number(structured?.offers?.price || structured?.offers?.lowPrice) || undefined,
  };
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Alleen GET is toegestaan." });
  }
  const code = String(request.query.code || "").replace(/\D/g, "");
  if (!isValidEan(code)) return response.status(400).json({ error: "Ongeldige EAN-code." });

  if (request.query.url) {
    try {
      const product = await scrapeProduct(String(request.query.url));
      return response.status(200).json({ code, product });
    } catch (error) {
      return response.status(422).json({ error: error instanceof Error ? error.message : "Productpagina kon niet worden gelezen." });
    }
  }

  const settled = await Promise.allSettled([
    ...PRODUCT_DATABASES.map((database) => lookupOpenFacts(database, code)),
    lookupUpcItemDb(code),
    lookupWikidata(code),
    searchWeb(code),
  ]);
  const candidates = settled.flatMap((result) => {
    if (result.status !== "fulfilled" || !result.value) return [];
    return Array.isArray(result.value) ? result.value : [result.value];
  });
  const unique = [...new Map(candidates.map((candidate) => [candidate.url || `${candidate.source}:${candidate.title}`, candidate])).values()];
  response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return response.status(200).json({ code, candidates: unique.slice(0, 10) });
}
