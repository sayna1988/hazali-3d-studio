import assert from "node:assert/strict";
import { test } from "node:test";
import { berekenPrint } from "../src/services/CalculationService.ts";
import type { Filament } from "../src/types/Filament.ts";
import type { Print } from "../src/types/Print.ts";
import type { SettingsModel } from "../src/types/Settings.ts";
import { berekenCatalogusPrijs } from "../src/utils/printPricing.ts";

function euro(value: number) {
  return Number(value.toFixed(2));
}

function filamentFixture(overrides: Partial<Filament>): Filament {
  return {
    id: 1,
    naam: "PLA zwart",
    merk: "Hazali",
    kleur: "#000000",
    type: "PLA",
    prijsPerKg: 20,
    voorraadGram: 1000,
    ...overrides,
  };
}

function printFixture(overrides: Partial<Print> = {}): Print {
  return {
    naam: "Testprint",
    aangemaaktOp: "2026-07-03T00:00:00.000Z",
    gewicht: 0,
    uren: 0,
    minuten: 0,
    filamentKleuren: [],
    filamentGewicht: 0,
    amsAfval: 0,
    materiaalKosten: 0,
    stroomKosten: 0,
    onderhoudKosten: 0,
    verpakkingKosten: 0,
    overigeKosten: 0,
    platform: "Etsy",
    platformKosten: 0,
    btw: 21,
    gewensteMarge: 0,
    kostprijs: 0,
    verkoopprijs: 0,
    winst: 0,
    ...overrides,
  };
}

test("berekent materiaalkosten uit gekoppelde spoelen en gramgewicht", () => {
  const filamenten = [
    filamentFixture({ id: 1, prijsPerKg: 20 }),
    filamentFixture({ id: 2, naam: "PETG wit", kleur: "#ffffff", type: "PETG", prijsPerKg: 30 }),
  ];
  const print = printFixture({
    verkoopprijs: 10,
    stroomKosten: 0.2,
    onderhoudKosten: 0.1,
    verpakkingKosten: 0.3,
    overigeKosten: 0.4,
    filamenten: [
      { kleur: "#000000", filamentId: 1, gewicht: 120 },
      { kleur: "#ffffff", filamentId: 2, gewicht: 80 },
    ],
  });

  const result = berekenCatalogusPrijs(print, filamenten);

  assert.equal(result.gebruiktGekoppeldFilament, true);
  assert.equal(result.gekoppeldGram, 200);
  assert.equal(euro(result.materiaalKosten), 4.8);
  assert.equal(euro(result.kostprijs), 5.8);
  assert.equal(euro(result.winst), 4.2);
});

test("valt terug op opgeslagen materiaalkosten zonder geldige spoelkoppeling", () => {
  const print = printFixture({
    materiaalKosten: 2.5,
    stroomKosten: 0.5,
    filamenten: [{ kleur: "#000000", gewicht: 100 }],
  });

  const result = berekenCatalogusPrijs(print, [filamentFixture({ id: 1 })]);

  assert.equal(result.gebruiktGekoppeldFilament, false);
  assert.equal(result.materiaalKosten, 2.5);
  assert.equal(result.kostprijs, 3);
});

test("neemt werk kosten mee in de algemene printberekening", () => {
  const filament = filamentFixture({ prijsPerKg: 20 });
  const settings: SettingsModel = {
    printerNaam: "Bambu Lab P2S",
    stroomPrijs: 0.5,
    printerVermogen: 1000,
    btw: 21,
    verpakking: 0.25,
    onderhoud: 0.75,
    werkKosten: 1.5,
    platform: "Etsy",
    platformKosten: 6.5,
  };

  const result = berekenPrint(500, 2, 0, 10, filament, settings);

  assert.equal(euro(result.materiaalKosten), 10);
  assert.equal(euro(result.stroomKosten), 1);
  assert.equal(euro(result.overigeKosten), 1.5);
  assert.equal(euro(result.kostprijs), 13.5);
  assert.equal(euro(result.verkoopprijs), 14.85);
  assert.equal(euro(result.verkoopprijsIncl), 17.97);
  assert.equal(euro(result.winst), 1.35);
});
