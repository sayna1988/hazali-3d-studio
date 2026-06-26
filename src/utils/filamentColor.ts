import type { Filament } from "../types/Filament";
import { colorName, safeColor } from "./colorNames";

const namedColors: Record<string, string> = {
  zwart: "#191b20",
  wit: "#f4f5f7",
  rood: "#ef4444",
  blauw: "#3b82f6",
  groen: "#22c55e",
  geel: "#facc15",
  oranje: "#f97316",
  paars: "#a855f7",
  grijs: "#8b95a5",
  roze: "#ec4899",
  naturel: "#e7dcc5",
  beige: "#d8c39a",
};

export function filamentColorValue(kleur: string) {
  const value = kleur.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  return namedColors[value] ?? safeColor(kleur);
}

export function filamentColorLabel(kleur: string, kleurNaam?: string) {
  const label = kleurNaam?.trim();
  return label || colorName(filamentColorValue(kleur));
}

export function filamentOptionLabel(filament: Filament) {
  return `${filament.merk || "Onbekend merk"} - ${filament.naam} - ${filamentColorLabel(filament.kleur, filament.kleurNaam)}`;
}
