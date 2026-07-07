import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateSlicingColorUsage,
  calculateSlicingTotals,
  parseSlicingResultText,
} from "../src/utils/slicingResultCalculator.ts";

test("leest Bambu/Orca slicing result gramregels per kleur uit", () => {
  const result = parseSlicingResultText(`
    Slicing Result
    Filament Model Support Purged Tower Total
    1 1.34 m 0.03 m 7.28 m 0.37 m 9.02 m
    4.05 g 0.11 g 22.05 g 1.13 g 27.34 g
    4 0.43 m 0.36 m 2.48 m 0.78 m 4.04 m
    1.29 g 1.08 g 7.52 g 2.35 g 12.24 g
    Total
    5.35 g 1.19 g 29.57 g 3.48 g 39.58 g
  `);

  assert.equal(result.colors.length, 2);
  assert.equal(result.ignoredSummaryRows, 1);
  assert.equal(result.colors[0]?.label, "1");
  assert.equal(result.colors[0]?.modelGram, 4.05);
  assert.equal(result.colors[0]?.supportGram, 0.11);
  assert.equal(result.colors[0]?.purgedGram, 22.05);
  assert.equal(result.colors[0]?.towerGram, 1.13);
  assert.equal(result.colors[0]?.recognizedTotalGram, 27.34);
  assert.equal(calculateSlicingColorUsage(result.colors[0]!).totalGram, 27.34);
  assert.equal(result.colors[1]?.label, "4");
  assert.equal(calculateSlicingColorUsage(result.colors[1]!).printGram, 2.37);
});

test("berekent totalen uit handmatig gecorrigeerde waarden", () => {
  const totals = calculateSlicingTotals([
    {
      id: "a",
      label: "Geel",
      color: "#f2c14e",
      modelGram: 4.05,
      supportGram: 0.11,
      purgedGram: 22.05,
      towerGram: 1.13,
      source: "manual",
    },
    {
      id: "b",
      label: "Zwart",
      color: "#111111",
      modelGram: 1.29,
      supportGram: 1.08,
      purgedGram: 7.52,
      towerGram: 2.35,
      source: "manual",
    },
  ]);

  assert.equal(totals.colors, 2);
  assert.equal(totals.printGram, 6.53);
  assert.equal(totals.purgedGram, 29.57);
  assert.equal(totals.towerGram, 3.48);
  assert.equal(totals.totalGram, 39.58);
});

test("berekent materiaalprijs per gekoppelde kleur via prijs per kilogram", () => {
  const row = calculateSlicingColorUsage({
    id: "a",
    label: "Geel",
    color: "#f2c14e",
    modelGram: 4.05,
    supportGram: 0.11,
    purgedGram: 22.05,
    towerGram: 1.13,
    filamentId: 12,
    filamentNaam: "Hazali PLA geel",
    filamentPrijsPerKg: 24.95,
    source: "manual",
  });

  assert.equal(row.printCost, 0.1);
  assert.equal(row.wasteCost, 0.58);
  assert.equal(row.materialCost, 0.68);

  const totals = calculateSlicingTotals([row]);
  assert.equal(totals.materialCost, 0.68);
});

test("herstelt OCR-gramwaarden waar decimalen zijn weggevallen", () => {
  const result = parseSlicingResultText(`
    1 1.34 m 0.03 m 7.28 m 0.37 m 9.02 m
    405 g 011 g 2205 g 113 g 2734 g
    4 0.43 m 0.36 m 2.48 m 0.78 m 4.04 m
    1 29 g 1 08 g 7 52 g 2 35 g 12 24 g
    Total
    535 g 119 g 2957 g 348 g 3958 g
  `);

  assert.equal(result.colors.length, 2);
  assert.equal(result.colors[0]?.modelGram, 4.05);
  assert.equal(result.colors[0]?.supportGram, 0.11);
  assert.equal(result.colors[0]?.purgedGram, 22.05);
  assert.equal(result.colors[0]?.towerGram, 1.13);
  assert.equal(result.colors[0]?.recognizedTotalGram, 27.34);
  assert.equal(result.colors[1]?.modelGram, 1.29);
  assert.equal(result.colors[1]?.supportGram, 1.08);
  assert.equal(result.colors[1]?.purgedGram, 7.52);
  assert.equal(result.colors[1]?.towerGram, 2.35);
  assert.equal(result.colors[1]?.recognizedTotalGram, 12.24);
});

test("accepteert komma-decimalen en OCR-verwarring in getallen", () => {
  const result = parseSlicingResultText(`
    2 0,50 m 0,00 m 1,20 m 0,40 m 2,10 m
    l,50 g O,OO g 3,60 g 1,20 g 6,30 g
  `);

  assert.equal(result.colors.length, 1);
  assert.equal(result.colors[0]?.modelGram, 1.5);
  assert.equal(result.colors[0]?.supportGram, 0);
  assert.equal(result.colors[0]?.totalGram, 6.3);
});
