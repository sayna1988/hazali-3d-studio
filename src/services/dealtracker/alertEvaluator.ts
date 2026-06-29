import type { SupabaseClient } from "@supabase/supabase-js";
import { sendAlertEmail } from "./alertEmail.ts";

type RuleRow = {
  id: string;
  user_id: string;
  product_id: string | null;
  material: string;
  brand: string | null;
  retailer_id: string | null;
  max_price_per_kg: number | string;
  min_total_weight_grams: number;
  in_stock_only: boolean;
  require_known_shipping: boolean;
};

type RetailerRow = { name: string };
type ProductRow = {
  id: string;
  retailer_id: string;
  product_name: string;
  brand: string;
  material: string;
  product_url: string;
  deal_retailers: RetailerRow | RetailerRow[] | null;
};
type VariantRow = {
  total_weight_grams: number;
  deal_products: ProductRow | ProductRow[] | null;
};

type OfferRow = {
  id: string;
  price_per_kg: number | string;
  total_price: number | string;
  shipping_cost: number | string;
  shipping_cost_known: boolean;
  stock_status: string;
  checked_at: string;
  deal_product_variants: VariantRow | VariantRow[] | null;
};

type PreviousEvent = {
  price_per_kg: number | string;
  created_at: string;
};

export type AlertEvaluationResult = {
  evaluatedRules: number;
  createdEvents: number;
  skippedCooldown: number;
};

const COOLDOWN_MS = 48 * 60 * 60 * 1000;
const MEANINGFUL_DROP_EUR = 0.5;
const MEANINGFUL_DROP_RATIO = 0.03;

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

function numberValue(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function kgLabel(grams: number) {
  return `${(grams / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 2 })} kg`;
}

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function offerParts(offer: OfferRow) {
  const variant = first(offer.deal_product_variants);
  const product = first(variant?.deal_products);
  const retailer = first(product?.deal_retailers);
  return variant && product && retailer ? { variant, product, retailer } : null;
}

function eventKey(rule: RuleRow, offer: OfferRow, price: number) {
  const bucket = Math.floor(price * 20) / 20;
  return `${rule.user_id}:${rule.id}:${offer.id}:${bucket.toFixed(2)}`;
}

function offerMatches(rule: RuleRow, offer: OfferRow) {
  const parts = offerParts(offer);
  if (!parts) return false;
  const { product, variant } = parts;
  if (rule.product_id && product.id !== rule.product_id) return false;
  if (product.material !== rule.material) return false;
  if (rule.brand && product.brand !== rule.brand) return false;
  if (rule.retailer_id && product.retailer_id !== rule.retailer_id) return false;
  if (rule.in_stock_only && offer.stock_status !== "in_stock") return false;
  if (rule.require_known_shipping && !offer.shipping_cost_known) return false;
  if (variant.total_weight_grams < rule.min_total_weight_grams) return false;
  return numberValue(offer.price_per_kg) <= numberValue(rule.max_price_per_kg);
}

function shouldTrigger(previous: PreviousEvent | null, currentPrice: number) {
  if (!previous) return { trigger: true, reason: "De prijs is onder je ingestelde grens gekomen." };
  if (Date.now() - new Date(previous.created_at).getTime() < COOLDOWN_MS) {
    return { trigger: false, reason: "Recent al gemeld." };
  }
  const previousPrice = numberValue(previous.price_per_kg);
  const drop = previousPrice - currentPrice;
  if (drop >= MEANINGFUL_DROP_EUR || drop / Math.max(previousPrice, 0.01) >= MEANINGFUL_DROP_RATIO) {
    return { trigger: true, reason: `De prijs is verder gedaald van ${euro.format(previousPrice)} naar ${euro.format(currentPrice)} per kg.` };
  }
  return { trigger: false, reason: "Geen betekenisvolle verdere prijsdaling." };
}

export const alertEvaluatorTestInternals = {
  eventKey,
  offerMatches,
  shouldTrigger,
};

export async function evaluateDealAlerts(client: SupabaseClient, runId: string, appBaseUrl: string): Promise<AlertEvaluationResult> {
  const { data: rules, error: rulesError } = await client
    .from("deal_tracker_rules")
    .select("id,user_id,product_id,material,brand,retailer_id,max_price_per_kg,min_total_weight_grams,in_stock_only,require_known_shipping")
    .eq("active", true);
  if (rulesError) throw rulesError;

  const { data: offers, error: offersError } = await client
    .from("deal_offers")
    .select(`
      id,
      price_per_kg,
      total_price,
      shipping_cost,
      shipping_cost_known,
      stock_status,
      checked_at,
      deal_product_variants (
        total_weight_grams,
        deal_products (
          id,
          retailer_id,
          product_name,
          brand,
          material,
          product_url,
          deal_retailers ( name )
        )
      )
    `);
  if (offersError) throw offersError;

  let createdEvents = 0;
  let skippedCooldown = 0;

  for (const rule of (rules ?? []) as RuleRow[]) {
    for (const offer of (offers ?? []) as unknown as OfferRow[]) {
      if (!offerMatches(rule, offer)) continue;
      const parts = offerParts(offer);
      if (!parts) continue;

      const { data: previousEvents, error: previousError } = await client
        .from("deal_alert_events")
        .select("price_per_kg,created_at")
        .eq("tracker_rule_id", rule.id)
        .eq("offer_id", offer.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (previousError) throw previousError;

      const currentPrice = numberValue(offer.price_per_kg);
      const previous = ((previousEvents ?? []) as PreviousEvent[])[0] ?? null;
      const decision = shouldTrigger(previous, currentPrice);
      if (!decision.trigger) {
        skippedCooldown += 1;
        continue;
      }

      const userResult = await client.auth.admin.getUserById(rule.user_id);
      const email = userResult.data.user?.email;
      if (!email) continue;

      const { product, retailer, variant } = parts;
      const manageUrl = `${appBaseUrl.replace(/\/$/, "")}/dealtracker`;
      const emailResult = await sendAlertEmail({
        to: email,
        subject: `Hazali prijsalarm: ${product.product_name}`,
        productName: product.product_name,
        currentPrice: euro.format(numberValue(offer.total_price)),
        pricePerKg: euro.format(currentPrice),
        shippingCost: offer.shipping_cost_known ? euro.format(numberValue(offer.shipping_cost)) : "Onbekend",
        totalWeight: kgLabel(variant.total_weight_grams),
        retailerName: retailer.name,
        offerUrl: product.product_url,
        reason: decision.reason,
        manageUrl,
      });

      const { error: insertError } = await client.from("deal_alert_events").upsert({
        user_id: rule.user_id,
        tracker_rule_id: rule.id,
        offer_id: offer.id,
        scrape_run_id: runId,
        event_key: eventKey(rule, offer, currentPrice),
        price_per_kg: currentPrice,
        previous_price_per_kg: previous ? numberValue(previous.price_per_kg) : null,
        reason: decision.reason,
        notification_status: emailResult.status,
        email_to: email,
        email_subject: `Hazali prijsalarm: ${product.product_name}`,
        email_error: emailResult.error ?? null,
        sent_at: emailResult.status === "sent" ? new Date().toISOString() : null,
      }, { onConflict: "user_id,event_key" });
      if (insertError) throw insertError;

      await client
        .from("deal_tracker_rules")
        .update({ last_triggered_at: new Date().toISOString() })
        .eq("id", rule.id);
      createdEvents += 1;
    }
  }

  return { evaluatedRules: (rules ?? []).length, createdEvents, skippedCooldown };
}
