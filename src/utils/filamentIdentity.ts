import type { Filament } from "../types/Filament";
import { colorName } from "./colorNames";
import { rolGegevens } from "./filamentInventory";

function normalize(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f\s_-]/g, "");
}

export function filamentKey(filament: Pick<Filament, "ean" | "naam" | "merk" | "kleur" | "type" | "voorraadGram" | "aantalRollen" | "gramPerRol">) {
  if (filament.ean?.trim()) return `ean:${filament.ean.trim()}`;
  const rollen = rolGegevens(filament as Filament);
  return [filament.merk, filament.naam, filament.type, colorName(filament.kleur), String(Math.round(rollen.gram))]
    .map(normalize)
    .join("|");
}
