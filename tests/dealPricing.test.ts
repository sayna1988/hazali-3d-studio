import { strict as assert } from "node:assert";
import test from "node:test";
import {
  calculatePricePerKgCents,
  calculateTotalPriceCents,
  centsToEuro,
  euroToCents,
  gramsToKilograms,
  normalizeMaterialName,
  normalizeStockStatus,
  roundEuroAmount,
  totalMultipackWeightGrams,
  validateDealOffer,
} from "../src/utils/dealPricing.ts";

test("berekent 1 rol van 1 kg", () => {
  const result = validateDealOffer({
    productPrice: 19.99,
    spoolWeightGrams: 1000,
    spoolCount: 1,
    stockStatus: "op voorraad",
    material: "PLA",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.pricing?.totalWeightGrams, 1000);
  assert.equal(result.pricing?.pricePerKgCents, 1999);
});

test("berekent 4 rollen van 250 gram als 1 kg totaal", () => {
  const result = validateDealOffer({
    productPrice: 18,
    spoolWeightGrams: 250,
    spoolCount: 4,
    stockStatus: "available",
    material: "PLA+",
  });

  assert.equal(result.accepted, true);
  assert.equal(totalMultipackWeightGrams(250, 4), 1000);
  assert.equal(result.pricing?.pricePerKgCents, 1800);
});

test("berekent 2 rollen van 1 kg als 2 kg totaal", () => {
  const result = validateDealOffer({
    productPrice: 35,
    spoolWeightGrams: 1000,
    spoolCount: 2,
    stockStatus: "in stock",
    material: "PLA Basic",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.pricing?.totalWeightGrams, 2000);
  assert.equal(result.pricing?.pricePerKgCents, 1750);
});

test("neemt verzendkosten mee in prijs per kilogram", () => {
  const result = validateDealOffer({
    productPrice: 20,
    shippingCost: 4.95,
    spoolWeightGrams: 1000,
    spoolCount: 1,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.pricing?.totalPriceCents, 2495);
  assert.equal(result.pricing?.pricePerKgCents, 2495);
});

test("neemt directe korting mee in totaalprijs", () => {
  const result = validateDealOffer({
    productPrice: 25,
    directDiscount: 5,
    spoolWeightGrams: 1000,
    spoolCount: 1,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.pricing?.totalPriceCents, 2000);
  assert.equal(result.pricing?.pricePerKgCents, 2000);
});

test("ondersteunt gratis verzending als nul verzendkosten", () => {
  const total = calculateTotalPriceCents(euroToCents(21.5), euroToCents(0), euroToCents(0));

  assert.equal(total, 2150);
  assert.equal(calculatePricePerKgCents(total, 1000), 2150);
});

test("wijst ontbrekend gewicht af", () => {
  const result = validateDealOffer({ productPrice: 20 });

  assert.equal(result.accepted, false);
  assert.ok(result.errors.includes("total_weight_invalid"));
});

test("wijst nulgewicht af", () => {
  const result = validateDealOffer({
    productPrice: 20,
    spoolWeightGrams: 0,
    spoolCount: 1,
  });

  assert.equal(result.accepted, false);
  assert.ok(result.errors.includes("total_weight_invalid"));
});

test("wijst negatieve prijs af", () => {
  const result = validateDealOffer({
    productPrice: -1,
    spoolWeightGrams: 1000,
    spoolCount: 1,
  });

  assert.equal(result.accepted, false);
  assert.ok(result.errors.includes("product_price_invalid"));
});

test("normaliseert onbekende voorraadstatus naar unknown", () => {
  assert.equal(normalizeStockStatus("morgen misschien"), "unknown");
  assert.equal(normalizeStockStatus(undefined), "unknown");
});

test("rondt eurobedragen af via centen", () => {
  assert.equal(euroToCents(10.005), 1001);
  assert.equal(centsToEuro(1001), 10.01);
  assert.equal(roundEuroAmount(1.005), 1.01);
});

test("converteert gram naar kilogram", () => {
  assert.equal(gramsToKilograms(750), 0.75);
  assert.equal(gramsToKilograms(0), 0);
});

test("normaliseert materiaalnamen", () => {
  assert.equal(normalizeMaterialName("PLA Plus"), "PLA+");
  assert.equal(normalizeMaterialName("pet-g"), "PETG");
  assert.equal(normalizeMaterialName("iets anders"), "UNKNOWN");
});
