import type { Filament } from "../types/Filament";

export function rolGegevens(filament: Filament) {
  if (filament.aantalRollen !== undefined && filament.gramPerRol !== undefined) {
    return { aantal: Math.max(0, Math.round(filament.aantalRollen)), gram: Math.max(1, filament.gramPerRol) };
  }
  if (filament.voorraadGram <= 0) return { aantal: 0, gram: 1000 };
  const aantal = filament.voorraadGram >= 1000 ? Math.max(1, Math.round(filament.voorraadGram / 1000)) : 1;
  return { aantal, gram: filament.voorraadGram / aantal };
}

export function totaalGewicht(filament: Filament) {
  const rollen = rolGegevens(filament);
  return rollen.aantal * rollen.gram;
}
