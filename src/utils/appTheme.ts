export const DEFAULT_APP_THEME_VARIANT = "hazali";

export const APP_THEME_VARIANTS = [
  {
    id: "hazali",
    label: "Hazali",
    description: "De standaard studio-look met diepe blauwtinten.",
  },
  {
    id: "glassmorphism",
    label: "Glassmorphism",
    description: "Transparante panelen, zachte randen en glasachtige diepte.",
  },
  {
    id: "aurora",
    label: "Aurora",
    description: "Een moderne mix van teal, violet en diepe nachttinten.",
  },
  {
    id: "graphite",
    label: "Graphite",
    description: "Rustige charcoal-basis met scherpe lime en cyan accenten.",
  },
  {
    id: "sage",
    label: "Sage",
    description: "Zachte groentinten met heldere mint en warme coral details.",
  },
  {
    id: "copper",
    label: "Copper",
    description: "Donkere studio-interface met koper, teal en amber.",
  },
  {
    id: "prism",
    label: "Prism",
    description: "Strakke donkere basis met fuchsia, cyan en gouden highlights.",
  },
] as const;

export type AppThemeVariant = (typeof APP_THEME_VARIANTS)[number]["id"];

const APP_THEME_STORAGE_KEY = "appThemeVariant";

export function isAppThemeVariant(value: unknown): value is AppThemeVariant {
  return typeof value === "string" && APP_THEME_VARIANTS.some((theme) => theme.id === value);
}

export function normalizeAppThemeVariant(value: unknown): AppThemeVariant {
  if (typeof value !== "string") return DEFAULT_APP_THEME_VARIANT;
  const normalized = value.trim().toLowerCase();
  return isAppThemeVariant(normalized) ? normalized : DEFAULT_APP_THEME_VARIANT;
}

export function getStoredAppThemeVariant(): AppThemeVariant {
  if (typeof localStorage === "undefined") return DEFAULT_APP_THEME_VARIANT;
  return normalizeAppThemeVariant(localStorage.getItem(APP_THEME_STORAGE_KEY));
}

export function storeAppThemeVariant(variant: AppThemeVariant) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(APP_THEME_STORAGE_KEY, variant);
  }
}

export function applyAppThemeVariant(variant: AppThemeVariant) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.hazaliTheme = variant;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", themeColorForVariant(variant));
}

export function applyStoredAppThemeVariant() {
  const variant = getStoredAppThemeVariant();
  storeAppThemeVariant(variant);
  applyAppThemeVariant(variant);
  return variant;
}

export function announceAppThemeVariant(variant: AppThemeVariant) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("hazali:app-theme-changed", { detail: { variant } }));
}

function themeColorForVariant(variant: AppThemeVariant) {
  switch (variant) {
    case "glassmorphism":
      return "#d8f3ff";
    case "aurora":
      return "#14b8a6";
    case "graphite":
      return "#a3e635";
    case "sage":
      return "#7dd3a8";
    case "copper":
      return "#d97706";
    case "prism":
      return "#d946ef";
    default:
      return "#0094ff";
  }
}
