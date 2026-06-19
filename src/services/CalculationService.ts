import type { Filament } from "../types/Filament";
import type { SettingsModel } from "../types/Settings";

export interface CalculationResult {
  materiaalKosten: number;
  stroomKosten: number;
  verpakkingKosten: number;
  onderhoudKosten: number;
  overigeKosten: number;

  kostprijs: number;
  verkoopprijs: number;
  verkoopprijsIncl: number;
  winst: number;
}

export function berekenPrint(
  gewicht: number,
  uren: number,
  minuten: number,
  marge: number,
  filament: Filament | undefined,
  settings: SettingsModel | null
): CalculationResult {

  const materiaalKosten =
    filament
      ? (gewicht / 1000) * filament.prijsPerKg
      : 0;

  const stroomKosten =
    settings
      ? (((uren * 60) + minuten) / 60) *
        (settings.printerVermogen / 1000) *
        settings.stroomPrijs
      : 0;

  const verpakkingKosten =
    settings
      ? settings.verpakking
      : 0.30;

  const onderhoudKosten =
    settings
      ? settings.onderhoud
      : 0.10;

  const overigeKosten = 0;

  const kostprijs =
    materiaalKosten +
    stroomKosten +
    verpakkingKosten +
    onderhoudKosten +
    overigeKosten;

  const verkoopprijs =
    kostprijs *
    (1 + marge / 100);

  const verkoopprijsIncl =
    verkoopprijs *
    (1 + (settings?.btw ?? 21) / 100);

  const winst =
    verkoopprijs -
    kostprijs;

  return {

    materiaalKosten,

    stroomKosten,

    verpakkingKosten,

    onderhoudKosten,

    overigeKosten,

    kostprijs,

    verkoopprijs,

    verkoopprijsIncl,

    winst

  };

}