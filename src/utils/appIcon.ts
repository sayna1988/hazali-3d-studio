export const DEFAULT_APP_ICON_VARIANT = "03";

export const APP_ICON_VARIANTS = [
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
] as const;

export type AppIconVariant = (typeof APP_ICON_VARIANTS)[number];

const APP_ICON_STORAGE_KEY = "appIconVariant";
const APP_ICON_COOKIE_NAME = "appIconVariant";

export function isAppIconVariant(value: unknown): value is AppIconVariant {
  return typeof value === "string" && APP_ICON_VARIANTS.includes(value as AppIconVariant);
}

export function normalizeAppIconVariant(value: unknown): AppIconVariant {
  if (typeof value === "number") {
    return normalizeAppIconVariant(String(value));
  }

  if (typeof value !== "string") {
    return DEFAULT_APP_ICON_VARIANT;
  }

  const normalized = value.trim().padStart(2, "0");
  return isAppIconVariant(normalized) ? normalized : DEFAULT_APP_ICON_VARIANT;
}

export function getAppIconPath(variant: AppIconVariant, size?: 192 | 512) {
  return `/icons/app-icon-${variant}${size ? `-${size}` : ""}.png`;
}

export function getAppManifestPath(variant: AppIconVariant) {
  return `/api/manifest?variant=${variant}`;
}

export function setFavicon(iconPath: string) {
  if (typeof document === "undefined") return;

  let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }

  favicon.type = "image/png";
  favicon.href = iconPath;
}

export function setAppManifest(variant: AppIconVariant) {
  if (typeof document === "undefined") return;

  let manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!manifest) {
    manifest = document.createElement("link");
    manifest.rel = "manifest";
    document.head.appendChild(manifest);
  }

  manifest.href = getAppManifestPath(variant);
  manifest.crossOrigin = "use-credentials";
}

export function getStoredAppIconVariant(): AppIconVariant {
  if (typeof localStorage === "undefined") return DEFAULT_APP_ICON_VARIANT;
  return normalizeAppIconVariant(localStorage.getItem(APP_ICON_STORAGE_KEY));
}

export function storeAppIconVariant(variant: AppIconVariant) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(APP_ICON_STORAGE_KEY, variant);
  }

  if (typeof document !== "undefined") {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${APP_ICON_COOKIE_NAME}=${variant}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    setAppManifest(variant);
  }
}

export function applyStoredAppIconVariant() {
  const variant = getStoredAppIconVariant();
  storeAppIconVariant(variant);
  setFavicon(getAppIconPath(variant));
  return variant;
}

export function announceAppIconVariant(variant: AppIconVariant) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("hazali:app-icon-changed", { detail: { variant } }));
}
