const PRODUCT_DATABASES = [
  { name: "Open Products Facts", url: "https://world.openproductsfacts.org" },
  { name: "Open Food Facts", url: "https://world.openfoodfacts.org" },
];

function isValidEan(code) {
  if (!/^\d{8}$|^\d{13}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const checkDigit = digits.pop();
  const sum = digits.reverse().reduce(
    (total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1),
    0,
  );
  return (10 - (sum % 10)) % 10 === checkDigit;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Hazali3DStudio/1.0 (https://www.hazali.nl)",
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) return null;
  return response.json();
}

async function lookupOpenFacts(database, code) {
  const fields = "code,product_name,product_name_en,generic_name,brands,categories,image_front_url";
  const data = await fetchJson(
    `${database.url}/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`,
  );
  const product = data?.status === 1 ? data.product : null;
  const name = product?.product_name || product?.product_name_en || product?.generic_name;
  if (!name) return null;

  return {
    name,
    brand: product.brands?.split(",")[0]?.trim() || "Onbekend merk",
    description: product.generic_name || product.categories || "",
    category: product.categories || "",
    image: product.image_front_url || "",
    source: database.name,
  };
}

async function lookupUpcItemDb(code) {
  const data = await fetchJson(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`,
  );
  const product = data?.items?.[0];
  if (!product?.title) return null;

  return {
    name: product.title,
    brand: product.brand || "Onbekend merk",
    description: product.description || "",
    category: product.category || "",
    image: product.images?.[0] || "",
    source: "UPCitemdb",
  };
}

async function lookupWikidata(code) {
  const query = `SELECT ?item ?itemLabel ?manufacturerLabel WHERE {
    ?item wdt:P3962 "${code}".
    OPTIONAL { ?item wdt:P176 ?manufacturer. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "nl,en". }
  } LIMIT 1`;
  const data = await fetchJson(
    `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`,
  );
  const result = data?.results?.bindings?.[0];
  const name = result?.itemLabel?.value;
  if (!name || name === result?.item?.value) return null;

  return {
    name,
    brand: result.manufacturerLabel?.value || "Onbekend merk",
    description: "",
    category: "",
    image: "",
    source: "Wikidata",
  };
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Alleen GET is toegestaan." });
  }

  const code = String(request.query.code || "").replace(/\D/g, "");
  if (!isValidEan(code)) {
    return response.status(400).json({ error: "Ongeldige EAN-code." });
  }

  const results = await Promise.allSettled([
    ...PRODUCT_DATABASES.map((database) => lookupOpenFacts(database, code)),
    lookupUpcItemDb(code),
    lookupWikidata(code),
  ]);
  const product = results.find(
    (result) => result.status === "fulfilled" && result.value,
  )?.value;

  response.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  if (!product) {
    return response.status(404).json({ error: "Deze EAN-code is niet gevonden in de openbare productdatabases." });
  }

  return response.status(200).json({ code, product });
}
