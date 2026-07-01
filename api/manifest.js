const DEFAULT_APP_ICON_VARIANT = "03";
const APP_ICON_VARIANTS = new Set([
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
]);

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeVariant(value) {
  const normalized = String(value || "").trim().padStart(2, "0");
  return APP_ICON_VARIANTS.has(normalized) ? normalized : DEFAULT_APP_ICON_VARIANT;
}

function cookieValue(cookieHeader, name) {
  return String(cookieHeader || "")
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export default function handler(request, response) {
  const queryVariant = first(request.query?.variant);
  const cookieVariant = cookieValue(request.headers.cookie, "appIconVariant");
  const variant = normalizeVariant(queryVariant || cookieVariant);

  response.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  return response.status(200).json({
    name: "Hazali 3D Studio",
    short_name: "Hazali",
    theme_color: "#0094FF",
    background_color: "#050B14",
    display: "standalone",
    orientation: "portrait",
    start_url: "/",
    scope: "/",
    icons: [
      {
        src: `/icons/app-icon-${variant}-192.png`,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: `/icons/app-icon-${variant}-512.png`,
        sizes: "512x512",
        type: "image/png",
      },
    ],
  });
}
