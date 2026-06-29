import assert from "node:assert/strict";
import { test } from "node:test";
import { renderAlertEmail, sendAlertEmail } from "../src/services/dealtracker/alertEmail.ts";
import { alertEvaluatorTestInternals } from "../src/services/dealtracker/alertEvaluator.ts";

const baseRule = {
  id: "rule-1",
  user_id: "user-1",
  product_id: "product-1",
  material: "PLA",
  brand: "Hazali",
  retailer_id: "retailer-1",
  max_price_per_kg: "15.00",
  min_total_weight_grams: 750,
  in_stock_only: true,
  require_known_shipping: true,
};

const baseOffer = {
  id: "offer-1",
  price_per_kg: "14.50",
  total_price: "29.00",
  shipping_cost: "4.95",
  shipping_cost_known: true,
  stock_status: "in_stock",
  checked_at: "2026-06-30T08:00:00.000Z",
  deal_product_variants: {
    total_weight_grams: 2000,
    deal_products: {
      id: "product-1",
      retailer_id: "retailer-1",
      product_name: "Hazali PLA zwart",
      brand: "Hazali",
      material: "PLA",
      product_url: "https://example.com/products/pla-zwart",
      deal_retailers: { name: "Joybuy" },
    },
  },
};

test("alertvoorwaarden matchen alleen geldige all-in aanbiedingen", () => {
  assert.equal(alertEvaluatorTestInternals.offerMatches(baseRule, baseOffer), true);
  assert.equal(alertEvaluatorTestInternals.offerMatches(baseRule, { ...baseOffer, shipping_cost_known: false }), false);
  assert.equal(alertEvaluatorTestInternals.offerMatches(baseRule, { ...baseOffer, stock_status: "out_of_stock" }), false);
  assert.equal(alertEvaluatorTestInternals.offerMatches(baseRule, {
    ...baseOffer,
    deal_product_variants: { ...baseOffer.deal_product_variants, total_weight_grams: 500 },
  }), false);
  assert.equal(alertEvaluatorTestInternals.offerMatches(baseRule, { ...baseOffer, price_per_kg: "15.50" }), false);
});

test("alert wordt niet iedere run herhaald binnen de cooldown", () => {
  const previous = { price_per_kg: "14.75", created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() };
  const decision = alertEvaluatorTestInternals.shouldTrigger(previous, 14.25);
  assert.equal(decision.trigger, false);
  assert.match(decision.reason, /Recent/);
});

test("alert ontstaat opnieuw na betekenisvolle verdere prijsdaling", () => {
  const previous = { price_per_kg: "15.00", created_at: new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString() };
  const decision = alertEvaluatorTestInternals.shouldTrigger(previous, 14.40);
  assert.equal(decision.trigger, true);
  assert.match(decision.reason, /verder gedaald/);
});

test("kleine prijsbeweging na cooldown geeft geen nieuwe alert", () => {
  const previous = { price_per_kg: "15.00", created_at: new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString() };
  const decision = alertEvaluatorTestInternals.shouldTrigger(previous, 14.80);
  assert.equal(decision.trigger, false);
  assert.match(decision.reason, /Geen betekenisvolle/);
});

test("event-key bucket voorkomt dubbele vrijwel identieke meldingen", () => {
  const first = alertEvaluatorTestInternals.eventKey(baseRule, baseOffer, 14.51);
  const second = alertEvaluatorTestInternals.eventKey(baseRule, baseOffer, 14.54);
  assert.equal(first, second);
});

test("prijsalert-email rendert Nederlandse inhoud en links", () => {
  const rendered = renderAlertEmail({
    to: "tester@example.com",
    subject: "Hazali prijsalarm",
    productName: "Hazali PLA zwart",
    currentPrice: "€ 29,00",
    pricePerKg: "€ 14,50",
    shippingCost: "€ 4,95",
    totalWeight: "2 kg",
    retailerName: "Joybuy",
    offerUrl: "https://example.com/products/pla-zwart",
    reason: "De prijs is onder je ingestelde grens gekomen.",
    manageUrl: "https://hazali.example/dealtracker",
  });

  assert.equal(rendered.subject, "Hazali prijsalarm");
  assert.match(rendered.text, /Hazali PLA zwart/);
  assert.match(rendered.text, /Prijs per kilogram: € 14,50/);
  assert.match(rendered.html, /Bekijk aanbieding/);
  assert.match(rendered.html, /Prijsalarm beheren of uitschakelen/);
});

test("development/logmodus verstuurt geen echte e-mail", async () => {
  const previousMode = process.env.DEALTRACKER_EMAIL_MODE;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.DEALTRACKER_EMAIL_MODE = "log";
  process.env.NODE_ENV = "development";
  const result = await sendAlertEmail({
    to: "real-user@example.com",
    subject: "Hazali prijsalarm",
    productName: "Hazali PLA zwart",
    currentPrice: "€ 29,00",
    pricePerKg: "€ 14,50",
    shippingCost: "€ 4,95",
    totalWeight: "2 kg",
    retailerName: "Joybuy",
    offerUrl: "https://example.com/products/pla-zwart",
    reason: "De prijs is onder je ingestelde grens gekomen.",
    manageUrl: "https://hazali.example/dealtracker",
  });
  process.env.DEALTRACKER_EMAIL_MODE = previousMode;
  process.env.NODE_ENV = previousNodeEnv;
  assert.equal(result.status, "skipped");
});
