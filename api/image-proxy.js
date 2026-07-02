export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Methode niet toegestaan." });
  }

  const sourceUrl = String(request.query.url || "").trim();
  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return response.status(400).json({ error: "Ongeldige afbeelding." });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return response.status(400).json({ error: "Ongeldige afbeelding." });
  }

  try {
    const upstream = await fetch(parsedUrl.href, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!upstream.ok) {
      return response.status(upstream.status).json({ error: `Afbeelding antwoordde met status ${upstream.status}.` });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return response.status(415).json({ error: "URL is geen afbeelding." });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    response.setHeader("Content-Type", contentType);
    return response.status(200).send(buffer);
  } catch {
    return response.status(502).json({ error: "Afbeelding ophalen is mislukt." });
  }
}
