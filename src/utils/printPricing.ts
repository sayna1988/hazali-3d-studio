import type { Filament } from "../types/Filament";
import type { Print } from "../types/Print";

export interface CatalogPricing {
  materiaalKosten: number;
  kostprijs: number;
  winst: number;
  gekoppeldGram: number;
  gebruiktGekoppeldFilament: boolean;
}

function filamentPrijsPerKg(filamenten: Filament[], filamentId: number | undefined) {
  if (filamentId === undefined) return undefined;
  return filamenten.find((filament) => filament.id === filamentId)?.prijsPerKg;
}

export function berekenCatalogusPrijs(print: Print, filamenten: Filament[]): CatalogPricing {
  const gekoppeldeRegels = (print.filamenten ?? [])
    .map((regel) => ({
      gewicht: Math.max(0, Number(regel.gewicht || 0)),
      prijsPerKg: filamentPrijsPerKg(filamenten, regel.filamentId)
    }))
    .filter((regel) => regel.gewicht > 0 && regel.prijsPerKg !== undefined);

  if (!gekoppeldeRegels.length && print.filamentId !== undefined) {
    const prijsPerKg = filamentPrijsPerKg(filamenten, print.filamentId);
    const gewicht = Math.max(0, Number(print.filamentGewicht || print.gewicht || 0));
    if (prijsPerKg !== undefined && gewicht > 0) {
      gekoppeldeRegels.push({ gewicht, prijsPerKg });
    }
  }

  const gebruiktGekoppeldFilament = gekoppeldeRegels.length > 0;
  const gekoppeldGram = gekoppeldeRegels.reduce((som, regel) => som + regel.gewicht, 0);
  const materiaalKosten = gebruiktGekoppeldFilament
    ? gekoppeldeRegels.reduce((som, regel) => som + (regel.gewicht / 1000) * (regel.prijsPerKg ?? 0), 0)
    : Number(print.materiaalKosten || 0);
  const kostprijs =
    materiaalKosten +
    Number(print.stroomKosten || 0) +
    Number(print.onderhoudKosten || 0) +
    Number(print.verpakkingKosten || 0) +
    Number(print.overigeKosten || 0);

  return {
    materiaalKosten,
    kostprijs,
    winst: Number(print.verkoopprijs || 0) - kostprijs,
    gekoppeldGram,
    gebruiktGekoppeldFilament
  };
}

export function catalogPricingMap(prints: Print[], filamenten: Filament[]) {
  return Object.fromEntries(
    prints
      .filter((print) => print.id !== undefined)
      .map((print) => [print.id!, berekenCatalogusPrijs(print, filamenten)])
  );
}
