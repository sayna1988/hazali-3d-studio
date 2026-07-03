const DEFAULT_APP_ICON_VARIANT = "03";
const DEFAULT_APP_THEME_VARIANT = "hazali";
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
const APP_THEME_VARIANTS = new Set([
  "hazali",
  "glassmorphism",
  "aurora",
  "graphite",
  "sage",
  "copper",
  "prism",
  "noir-gold",
]);

const APP_THEME_COLORS = {
  hazali: {
    themeColor: "#0094FF",
    backgroundColor: "#050B14",
  },
  glassmorphism: {
    themeColor: "#899083",
    backgroundColor: "#899083",
  },
  aurora: {
    themeColor: "#14b8a6",
    backgroundColor: "#07111f",
  },
  graphite: {
    themeColor: "#a3e635",
    backgroundColor: "#111315",
  },
  sage: {
    themeColor: "#7dd3a8",
    backgroundColor: "#0d1712",
  },
  copper: {
    themeColor: "#d97706",
    backgroundColor: "#17110d",
  },
  prism: {
    themeColor: "#d946ef",
    backgroundColor: "#09090f",
  },
  "noir-gold": {
    themeColor: "#d5a536",
    backgroundColor: "#0f0f0e",
  },
};

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeVariant(value) {
  const normalized = String(value || "").trim().padStart(2, "0");
  return APP_ICON_VARIANTS.has(normalized) ? normalized : DEFAULT_APP_ICON_VARIANT;
}

function normalizeThemeVariant(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return APP_THEME_VARIANTS.has(normalized) ? normalized : DEFAULT_APP_THEME_VARIANT;
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
  const queryTheme = first(request.query?.theme);
  const cookieVariant = cookieValue(request.headers.cookie, "appIconVariant");
  const cookieTheme = cookieValue(request.headers.cookie, "appThemeVariant");
  const variant = normalizeVariant(queryVariant || cookieVariant);
  const theme = normalizeThemeVariant(queryTheme || cookieTheme);
  const colors = APP_THEME_COLORS[theme] || APP_THEME_COLORS[DEFAULT_APP_THEME_VARIANT];

  response.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  return response.status(200).json({
    name: "Hazali 3D Studio",
    short_name: "Hazali",
    theme_color: colors.themeColor,
    background_color: colors.backgroundColor,
    display: "standalone",
    orientation: "portrait",
    start_url: "/",
    scope: "/",
    icons: [
      {
        src: `/icons/app-icon-${variant}-180.png`,
        sizes: "180x180",
        type: "image/png",
      },
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
