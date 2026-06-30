// Generated Vercel function bundle from api/dealtracker-run.ts. Do not edit by hand.

// api/dealtracker-run.ts
import { createClient } from "@supabase/supabase-js";

// src/utils/dealPricing.ts
var STOCK_ALIASES = {
  "in stock": "in_stock",
  instock: "in_stock",
  voorraad: "in_stock",
  "op voorraad": "in_stock",
  beschikbaar: "in_stock",
  available: "in_stock",
  outofstock: "out_of_stock",
  "out of stock": "out_of_stock",
  uitverkocht: "out_of_stock",
  "niet op voorraad": "out_of_stock",
  soldout: "out_of_stock",
  backorder: "backorder",
  nabesteld: "backorder",
  preorder: "preorder",
  "pre-order": "preorder",
  vooruitbestellen: "preorder"
};
function totalMultipackWeightGrams(spoolWeightGrams, spoolCount) {
  if (!Number.isFinite(spoolWeightGrams) || !Number.isFinite(spoolCount)) return 0;
  if (spoolWeightGrams <= 0 || spoolCount <= 0) return 0;
  return Math.round(spoolWeightGrams) * Math.round(spoolCount);
}
function euroToCents(amount) {
  if (!Number.isFinite(amount)) return Number.NaN;
  return Math.round((amount + Number.EPSILON) * 100);
}
function centsToEuro(cents) {
  if (!Number.isFinite(cents)) return Number.NaN;
  return Math.round(cents) / 100;
}
function calculateTotalPriceCents(productPriceCents, shippingCostCents = 0, directDiscountCents = 0) {
  return productPriceCents + shippingCostCents - directDiscountCents;
}
function calculatePricePerKgCents(totalPriceCents, totalWeightGrams) {
  if (!Number.isFinite(totalPriceCents) || !Number.isFinite(totalWeightGrams) || totalWeightGrams <= 0) {
    return Number.NaN;
  }
  return Math.round(totalPriceCents * 1e3 / totalWeightGrams);
}
function normalizeStockStatus(value) {
  if (!value) return "unknown";
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return STOCK_ALIASES[normalized] ?? STOCK_ALIASES[normalized.replace(/\s/g, "")] ?? "unknown";
}
function normalizeMaterialName(value) {
  if (!value) return "UNKNOWN";
  const normalized = value.trim().toUpperCase().replace(/\s+/g, " ");
  if (/\bPLA\s*\+|\bPLA\s*(PLUS|PRO)\b/.test(normalized)) return "PLA+";
  if (/\bPLA\b/.test(normalized)) return "PLA";
  if (/\bPET\s*-?\s*G\b|\bPETG\b/.test(normalized)) return "PETG";
  if (/\bABS\b/.test(normalized)) return "ABS";
  if (/\bTPU\b/.test(normalized)) return "TPU";
  if (/\bASA\b/.test(normalized)) return "ASA";
  if (/\bPA\d*\b|\bNYLON\b/.test(normalized)) return "PA";
  if (/\bPC\b|\bPOLYCARBONATE\b/.test(normalized)) return "PC";
  return "UNKNOWN";
}
function resolveTotalWeightGrams(candidate) {
  if (candidate.totalWeightGrams !== void 0 && candidate.totalWeightGrams !== null) {
    return Number.isFinite(candidate.totalWeightGrams) && candidate.totalWeightGrams > 0 ? Math.round(candidate.totalWeightGrams) : 0;
  }
  return totalMultipackWeightGrams(candidate.spoolWeightGrams ?? 0, candidate.spoolCount ?? 1);
}
function validateDealOffer(candidate) {
  const errors = [];
  const productPriceCents = euroToCents(candidate.productPrice);
  const normalPriceCents = candidate.normalPrice === void 0 || candidate.normalPrice === null ? null : euroToCents(candidate.normalPrice);
  const directDiscountCents = euroToCents(candidate.directDiscount ?? 0);
  const shippingCostCents = euroToCents(candidate.shippingCost ?? 0);
  const totalWeightGrams = resolveTotalWeightGrams(candidate);
  const stockStatus = normalizeStockStatus(candidate.stockStatus);
  const material = normalizeMaterialName(candidate.material);
  if (!Number.isFinite(productPriceCents) || productPriceCents < 0) errors.push("product_price_invalid");
  if (normalPriceCents !== null && (!Number.isFinite(normalPriceCents) || normalPriceCents < 0)) errors.push("normal_price_invalid");
  if (!Number.isFinite(directDiscountCents) || directDiscountCents < 0) errors.push("direct_discount_invalid");
  if (!Number.isFinite(shippingCostCents) || shippingCostCents < 0) errors.push("shipping_cost_invalid");
  if (totalWeightGrams <= 0) errors.push("total_weight_invalid");
  const totalPriceCents = calculateTotalPriceCents(productPriceCents, shippingCostCents, directDiscountCents);
  if (!Number.isFinite(totalPriceCents) || totalPriceCents < 0) errors.push("total_price_invalid");
  const pricePerKgCents = calculatePricePerKgCents(totalPriceCents, totalWeightGrams);
  if (!Number.isFinite(pricePerKgCents) || pricePerKgCents < 0) errors.push("price_per_kg_invalid");
  if (errors.length) return { accepted: false, errors };
  return {
    accepted: true,
    errors,
    pricing: {
      productPriceCents,
      normalPriceCents,
      directDiscountCents,
      shippingCostCents,
      totalPriceCents,
      pricePerKgCents,
      totalWeightGrams,
      stockStatus,
      material
    }
  };
}

// src/services/dealtracker/SupabaseDealtrackerRepository.ts
function asRuntimeRetailer(row) {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    active: row.active,
    adapterKey: row.adapter_key,
    config: row.config,
    requestDelayMs: row.request_delay_ms,
    requestTimeoutMs: row.request_timeout_ms,
    maxConcurrency: row.max_concurrency
  };
}
function countOffers(products) {
  return products.reduce((sum, product) => sum + product.variants.length, 0);
}
function uniqueProducts(products) {
  return [...new Map(products.map((product) => [product.sourceId, product])).values()];
}
var SupabaseDealtrackerRepository = class {
  client;
  constructor(client) {
    this.client = client;
  }
  async createRun(options) {
    const { data, error } = await this.client.from("deal_scrape_runs").insert({
      status: "pending",
      trigger_source: options.triggerSource,
      dry_run: options.dryRun,
      validate_only: options.validateOnly,
      retailer_filter: options.retailerFilter ?? null,
      max_products: options.maxProducts ?? null
    }).select("id").single();
    if (error) throw error;
    return data.id;
  }
  async acquireRunLock(runId, maxRuntimeMs) {
    const expiresAt = new Date(Date.now() + maxRuntimeMs).toISOString();
    const { data: existing, error: readError } = await this.client.from("deal_scrape_locks").select("run_id,expires_at").eq("lock_name", "dealtracker").maybeSingle();
    if (readError) throw readError;
    const locked = existing;
    if (locked && new Date(locked.expires_at).getTime() > Date.now()) return false;
    const { error } = await this.client.from("deal_scrape_locks").upsert({
      lock_name: "dealtracker",
      run_id: runId,
      locked_at: (/* @__PURE__ */ new Date()).toISOString(),
      expires_at: expiresAt
    }, { onConflict: "lock_name" });
    if (error) throw error;
    return true;
  }
  async releaseRunLock(runId) {
    const { error } = await this.client.from("deal_scrape_locks").delete().eq("lock_name", "dealtracker").eq("run_id", runId);
    if (error) throw error;
  }
  async markRunRunning(runId) {
    const { error } = await this.client.from("deal_scrape_runs").update({ status: "running", started_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", runId);
    if (error) throw error;
  }
  async finishRun(runId, status, exitCode, exitReason, totals) {
    const { error } = await this.client.from("deal_scrape_runs").update({
      status,
      finished_at: (/* @__PURE__ */ new Date()).toISOString(),
      retailers_total: totals.retailersTotal,
      retailers_succeeded: totals.retailersSucceeded,
      retailers_failed: totals.retailersFailed,
      offers_seen: totals.offersSeen,
      observations_inserted: totals.observationsInserted,
      exit_code: exitCode,
      exit_reason: exitReason
    }).eq("id", runId);
    if (error) throw error;
  }
  async listActiveRetailers(retailerFilter) {
    let query = this.client.from("deal_retailers").select("id,name,domain,active,adapter_key,config,request_delay_ms,request_timeout_ms,max_concurrency").eq("active", true).order("name", { ascending: true });
    if (retailerFilter) {
      query = query.or(`adapter_key.eq.${retailerFilter},domain.eq.${retailerFilter}`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(asRuntimeRetailer);
  }
  async startRetailerRun(runId, retailer) {
    const { error } = await this.client.from("deal_scrape_run_retailers").upsert({
      run_id: runId,
      retailer_id: retailer.id,
      adapter_key: retailer.adapterKey,
      status: "running",
      started_at: (/* @__PURE__ */ new Date()).toISOString()
    }, { onConflict: "run_id,adapter_key" });
    if (error) throw error;
  }
  async finishRetailerRun(runId, retailer, status, summary, writeResult) {
    const { error } = await this.client.from("deal_scrape_run_retailers").upsert({
      run_id: runId,
      retailer_id: retailer.id,
      adapter_key: retailer.adapterKey,
      status,
      finished_at: (/* @__PURE__ */ new Date()).toISOString(),
      duration_ms: summary.durationMs,
      products_seen: summary.productsSeen,
      products_normalized: summary.productsNormalized,
      variants_normalized: summary.variantsNormalized,
      offers_normalized: writeResult.offersSeen,
      duplicate_offers_skipped: summary.duplicateOffersSkipped,
      observations_inserted: writeResult.observationsInserted,
      product_errors: summary.productErrors,
      fatal_errors: summary.fatalErrors,
      dry_run: summary.dryRun
    }, { onConflict: "run_id,adapter_key" });
    if (error) throw error;
  }
  async recordErrors(runId, retailer, errors) {
    if (!errors.length) return;
    const rows = errors.map((error2) => ({
      run_id: runId,
      retailer_id: retailer?.id ?? null,
      adapter_key: error2.retailerKey,
      error_code: error2.code,
      message: error2.message,
      details: {
        stage: error2.stage,
        sourceId: error2.sourceId ?? null,
        detailUrl: error2.detailUrl ?? null,
        retryable: error2.retryable
      }
    }));
    const { error } = await this.client.from("deal_scrape_run_errors").insert(rows);
    if (error) throw error;
  }
  async writeRetailerProducts(runId, retailer, products, options) {
    const offersSeen = countOffers(products);
    if (options.dryRun || options.validateOnly || !products.length) {
      return { offersSeen, observationsInserted: 0 };
    }
    const productRows = uniqueProducts(products).map((product) => ({
      retailer_id: retailer.id,
      source_id: product.sourceId,
      product_name: product.productName,
      brand: product.brand,
      material: product.material,
      product_url: product.productUrl,
      image_url: product.imageUrl ?? null,
      diameter_mm: product.diameterMm ?? null,
      active: true
    }));
    const { data: savedProducts, error: productError } = await this.client.from("deal_products").upsert(productRows, { onConflict: "retailer_id,source_id" }).select("id,source_id");
    if (productError) throw productError;
    const productIds = new Map((savedProducts ?? []).map((row) => [row.source_id, row.id]));
    const variantRows = products.flatMap((product) => product.variants.map((variant) => ({
      product_id: productIds.get(product.sourceId),
      variant_key: variant.variantKey,
      variant_source_id: variant.variantSourceId ?? null,
      sku: variant.sku ?? null,
      color: variant.color,
      spool_weight_grams: variant.spoolWeightGrams,
      spool_count: variant.spoolCount,
      active: true
    }))).filter((row) => row.product_id);
    const { data: savedVariants, error: variantError } = await this.client.from("deal_product_variants").upsert(variantRows, { onConflict: "product_id,variant_key" }).select("id,product_id,variant_key");
    if (variantError) throw variantError;
    const variantIds = new Map(
      (savedVariants ?? []).map((row) => [`${row.product_id}:${row.variant_key}`, row.id])
    );
    const offerRows = products.flatMap((product) => product.variants.map((variant) => {
      const productId = productIds.get(product.sourceId);
      const variantId = productId ? variantIds.get(`${productId}:${variant.variantKey}`) : void 0;
      return variantId ? {
        variant_id: variantId,
        product_price: centsToEuro(variant.offer.productPriceCents),
        normal_price: variant.offer.normalPriceCents === null ? null : centsToEuro(variant.offer.normalPriceCents),
        direct_discount: centsToEuro(variant.offer.directDiscountCents),
        shipping_cost_known: variant.offer.shippingCostKnown,
        shipping_cost: centsToEuro(variant.offer.shippingCostCents),
        total_price: centsToEuro(variant.offer.totalPriceCents),
        price_per_kg: centsToEuro(variant.offer.pricePerKgCents),
        currency: variant.offer.currency,
        stock_status: variant.offer.stockStatus,
        checked_at: variant.offer.checkedAt,
        source_hash: variant.offer.sourceHash
      } : null;
    })).filter((row) => row !== null);
    const { data: savedOffers, error: offerError } = await this.client.from("deal_offers").upsert(offerRows, { onConflict: "variant_id" }).select("id,variant_id");
    if (offerError) throw offerError;
    const offerIds = new Map((savedOffers ?? []).map((row) => [row.variant_id, row.id]));
    const observationRows = products.flatMap((product) => product.variants.map((variant) => {
      const productId = productIds.get(product.sourceId);
      const variantId = productId ? variantIds.get(`${productId}:${variant.variantKey}`) : void 0;
      const offerId = variantId ? offerIds.get(variantId) : void 0;
      return offerId ? {
        scrape_run_id: runId,
        offer_id: offerId,
        product_price: centsToEuro(variant.offer.productPriceCents),
        normal_price: variant.offer.normalPriceCents === null ? null : centsToEuro(variant.offer.normalPriceCents),
        direct_discount: centsToEuro(variant.offer.directDiscountCents),
        shipping_cost_known: variant.offer.shippingCostKnown,
        shipping_cost: centsToEuro(variant.offer.shippingCostCents),
        total_price: centsToEuro(variant.offer.totalPriceCents),
        price_per_kg: centsToEuro(variant.offer.pricePerKgCents),
        currency: variant.offer.currency,
        stock_status: variant.offer.stockStatus,
        checked_at: variant.offer.checkedAt,
        observation_hash: variant.offer.sourceHash
      } : null;
    })).filter((row) => row !== null);
    const uniqueObservationRows = [...new Map(
      observationRows.map((row) => [`${row.offer_id}:${row.observation_hash}`, row])
    ).values()];
    const { error: observationError } = await this.client.from("deal_price_observations").upsert(uniqueObservationRows, { onConflict: "scrape_run_id,offer_id,observation_hash" });
    if (observationError) throw observationError;
    await this.markMissingVariantsInactive(retailer, variantRows.map((row) => String(row.variant_key)));
    await this.client.from("deal_retailers").update({ last_successful_check_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", retailer.id);
    return { offersSeen, observationsInserted: uniqueObservationRows.length };
  }
  async markMissingVariantsInactive(retailer, seenVariantKeys) {
    const { data: productRows, error: productError } = await this.client.from("deal_products").select("id").eq("retailer_id", retailer.id);
    if (productError) throw productError;
    const productIds = (productRows ?? []).map((row) => row.id);
    if (!productIds.length) return;
    const { data: variantRows, error: readError } = await this.client.from("deal_product_variants").select("id,variant_key").in("product_id", productIds);
    if (readError) throw readError;
    const seen = new Set(seenVariantKeys);
    const missingIds = (variantRows ?? []).filter((row) => !seen.has(row.variant_key)).map((row) => row.id);
    if (!missingIds.length) return;
    const { error } = await this.client.from("deal_product_variants").update({ active: false }).in("id", missingIds);
    if (error) throw error;
  }
};

// src/services/dealtracker/alertEmail.ts
function htmlEscape(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function renderAlertEmail(input) {
  const buttonStyle = "display:inline-block;padding:12px 18px;border-radius:10px;background:#159cff;color:#ffffff;text-decoration:none;font-weight:700";
  return {
    subject: input.subject,
    html: `
      <h2>Je Hazali-prijsalarm is afgegaan</h2>
      <p><strong>${htmlEscape(input.productName)}</strong> voldoet nu aan je voorwaarden.</p>
      <ul>
        <li>Huidige prijs: ${htmlEscape(input.currentPrice)}</li>
        <li>Prijs per kilogram: ${htmlEscape(input.pricePerKg)}</li>
        <li>Verzendkosten: ${htmlEscape(input.shippingCost)}</li>
        <li>Totaalgewicht: ${htmlEscape(input.totalWeight)}</li>
        <li>Webwinkel: ${htmlEscape(input.retailerName)}</li>
      </ul>
      <p>Reden: ${htmlEscape(input.reason)}</p>
      <p><a href="${htmlEscape(input.offerUrl)}" style="${buttonStyle}">Bekijk aanbieding</a></p>
      <p><a href="${htmlEscape(input.manageUrl)}">Prijsalarm beheren of uitschakelen</a></p>
    `,
    text: [
      "Je Hazali-prijsalarm is afgegaan",
      "",
      `${input.productName} voldoet nu aan je voorwaarden.`,
      `Huidige prijs: ${input.currentPrice}`,
      `Prijs per kilogram: ${input.pricePerKg}`,
      `Verzendkosten: ${input.shippingCost}`,
      `Totaalgewicht: ${input.totalWeight}`,
      `Webwinkel: ${input.retailerName}`,
      `Reden: ${input.reason}`,
      `Bekijk aanbieding: ${input.offerUrl}`,
      `Beheren of uitschakelen: ${input.manageUrl}`
    ].join("\n")
  };
}
async function sendAlertEmail(input) {
  const mode = process.env.DEALTRACKER_EMAIL_MODE || "log";
  const testRecipient = process.env.DEALTRACKER_TEST_EMAIL_TO;
  const to = testRecipient || input.to;
  const rendered = renderAlertEmail({ ...input, to });
  if (mode === "off") return { status: "skipped" };
  if (mode === "log" || process.env.NODE_ENV !== "production") {
    console.info(JSON.stringify({
      level: "info",
      message: "dealtracker_alert_email_log",
      to,
      subject: rendered.subject
    }));
    return { status: "skipped" };
  }
  if (mode !== "resend") return { status: "failed", error: `Onbekende e-mailmodus: ${mode}.` };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DEALTRACKER_EMAIL_FROM;
  if (!apiKey || !from) return { status: "failed", error: "RESEND_API_KEY of DEALTRACKER_EMAIL_FROM ontbreekt." };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text
    })
  });
  if (!response.ok) return { status: "failed", error: `Resend HTTP ${response.status}.` };
  return { status: "sent" };
}

// src/services/dealtracker/alertEvaluator.ts
var COOLDOWN_MS = 48 * 60 * 60 * 1e3;
var MEANINGFUL_DROP_EUR = 0.5;
var MEANINGFUL_DROP_RATIO = 0.03;
var euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
function numberValue(value) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function kgLabel(grams) {
  return `${(grams / 1e3).toLocaleString("nl-NL", { maximumFractionDigits: 2 })} kg`;
}
function first(value) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
function offerParts(offer) {
  const variant = first(offer.deal_product_variants);
  const product = first(variant?.deal_products);
  const retailer = first(product?.deal_retailers);
  return variant && product && retailer ? { variant, product, retailer } : null;
}
function eventKey(rule, offer, price) {
  const bucket = Math.floor(price * 20) / 20;
  return `${rule.user_id}:${rule.id}:${offer.id}:${bucket.toFixed(2)}`;
}
function offerMatches(rule, offer) {
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
function shouldTrigger(previous, currentPrice) {
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
async function evaluateDealAlerts(client, runId, appBaseUrl) {
  const { data: rules, error: rulesError } = await client.from("deal_tracker_rules").select("id,user_id,product_id,material,brand,retailer_id,max_price_per_kg,min_total_weight_grams,in_stock_only,require_known_shipping").eq("active", true);
  if (rulesError) throw rulesError;
  const { data: offers, error: offersError } = await client.from("deal_offers").select(`
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
  for (const rule of rules ?? []) {
    for (const offer of offers ?? []) {
      if (!offerMatches(rule, offer)) continue;
      const parts = offerParts(offer);
      if (!parts) continue;
      const { data: previousEvents, error: previousError } = await client.from("deal_alert_events").select("price_per_kg,created_at").eq("tracker_rule_id", rule.id).eq("offer_id", offer.id).order("created_at", { ascending: false }).limit(1);
      if (previousError) throw previousError;
      const currentPrice = numberValue(offer.price_per_kg);
      const previous = (previousEvents ?? [])[0] ?? null;
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
        manageUrl
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
        sent_at: emailResult.status === "sent" ? (/* @__PURE__ */ new Date()).toISOString() : null
      }, { onConflict: "user_id,event_key" });
      if (insertError) throw insertError;
      await client.from("deal_tracker_rules").update({ last_triggered_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", rule.id);
      createdEvents += 1;
    }
  }
  return { evaluatedRules: (rules ?? []).length, createdEvents, skippedCooldown };
}

// src/services/dealtracker/logger.ts
var SECRET_KEY_PATTERN = /secret|token|key|password|cookie|authorization/i;
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      SECRET_KEY_PATTERN.test(key) ? "[redacted]" : redact(nested)
    ])
  );
}
function write(level, message, fields = {}) {
  const entry = {
    level,
    message,
    ...redact(fields)
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
function createStructuredLogger(baseFields = {}) {
  return {
    info: (message, fields = {}) => write("info", message, { ...baseFields, ...fields }),
    warn: (message, fields = {}) => write("warn", message, { ...baseFields, ...fields }),
    error: (message, fields = {}) => write("error", message, { ...baseFields, ...fields })
  };
}

// src/services/dealtracker/httpClient.ts
var DEFAULT_USER_AGENT = "HazaliDealtracker/1.0 (+https://hazali.nl; respectful price monitoring)";
var DEFAULT_ACCEPTED_TYPES = ["application/json", "text/json", "text/html", "application/xhtml+xml"];
var nextAllowedRequestAt = 0;
function defaultSleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
function isPrivateIpv4(hostname) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168;
}
function validatePublicHttpUrl(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("URL protocol is niet toegestaan.");
  if (url.username || url.password) throw new Error("URL mag geen credentials bevatten.");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "[::1]" || hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:") || isPrivateIpv4(hostname)) {
    throw new Error("Interne of lokale URL is niet toegestaan.");
  }
  return url;
}
function acceptsContentType(actual, accepted) {
  if (!actual) return false;
  const normalized = actual.split(";")[0]?.trim().toLowerCase() ?? "";
  return accepted.some((item) => normalized === item.toLowerCase());
}
function retryableStatus(status) {
  return status === 408 || status === 429 || status >= 500 && status <= 599;
}
function createDealHttpClient(options = {}) {
  const timeoutMs = options.timeoutMs ?? 1e4;
  const retries = options.retries ?? 2;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? 250;
  const rateLimitMs = options.rateLimitMs ?? 0;
  const maxResponseBytes = options.maxResponseBytes ?? 1e6;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const fetchFn = options.fetchFn ?? fetch;
  const sleep2 = options.sleep ?? defaultSleep;
  async function waitForRateLimit() {
    if (rateLimitMs <= 0) return;
    const now = Date.now();
    const waitMs = Math.max(0, nextAllowedRequestAt - now);
    nextAllowedRequestAt = Math.max(now, nextAllowedRequestAt) + rateLimitMs;
    if (waitMs > 0) await sleep2(waitMs);
  }
  async function fetchText(urlValue, requestOptions = {}) {
    const url = validatePublicHttpUrl(urlValue);
    const acceptedContentTypes = requestOptions.acceptedContentTypes ?? DEFAULT_ACCEPTED_TYPES;
    const limit = requestOptions.maxResponseBytes ?? maxResponseBytes;
    const requestTimeoutMs = requestOptions.timeoutMs ?? timeoutMs;
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (attempt > 0) await sleep2(retryBaseDelayMs * 2 ** (attempt - 1));
      await waitForRateLimit();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        const response = await fetchFn(url.href, {
          headers: {
            Accept: acceptedContentTypes.join(", "),
            "User-Agent": userAgent
          },
          redirect: "follow",
          signal: controller.signal
        });
        const contentType = response.headers.get("content-type") ?? "";
        if (!acceptsContentType(contentType, acceptedContentTypes)) {
          throw new Error(`Onverwacht content-type: ${contentType || "onbekend"}.`);
        }
        const contentLength = Number(response.headers.get("content-length") ?? 0);
        if (contentLength > limit) throw new Error("Response is groter dan toegestaan.");
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}.`);
          if (attempt < retries && retryableStatus(response.status)) {
            lastError = error;
            continue;
          }
          throw error;
        }
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > limit) throw new Error("Response is groter dan toegestaan.");
        return new TextDecoder().decode(buffer);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("HTTP request mislukt.");
        if (attempt >= retries) throw lastError;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new Error("HTTP request mislukt.");
  }
  async function fetchJson(url, requestOptions = {}) {
    const text = await fetchText(url, {
      ...requestOptions,
      acceptedContentTypes: requestOptions.acceptedContentTypes ?? ["application/json", "text/json"]
    });
    return JSON.parse(text);
  }
  return { fetchText, fetchJson };
}

// src/services/dealtracker/runAdapter.ts
function errorFromUnknown(error) {
  return error instanceof Error ? error.message : "Onbekende fout.";
}
async function mapWithConcurrency(values, limit, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, values.length)) }, worker));
  return results;
}
function dedupeProducts(products) {
  const duplicateOfferKeys = /* @__PURE__ */ new Set();
  const mergedProducts = /* @__PURE__ */ new Map();
  for (const product of products) {
    const productKey = `${product.retailerKey}:${product.sourceId}`;
    const existingProduct = mergedProducts.get(productKey);
    const baseProduct = existingProduct ?? { ...product, variants: [] };
    const variantsByKey = new Map(baseProduct.variants.map((variant) => [variant.variantKey, variant]));
    for (const variant of product.variants) {
      const offerKey = `${productKey}:${variant.variantKey}:${variant.offer.sourceHash}`;
      if (duplicateOfferKeys.has(offerKey)) continue;
      duplicateOfferKeys.add(offerKey);
      if (!variantsByKey.has(variant.variantKey)) {
        variantsByKey.set(variant.variantKey, variant);
      }
    }
    mergedProducts.set(productKey, { ...baseProduct, variants: [...variantsByKey.values()] });
  }
  const deduped = [...mergedProducts.values()].filter((product) => product.variants.length > 0);
  const offersBefore = products.reduce((sum, product) => sum + product.variants.length, 0);
  const offersAfter = deduped.reduce((sum, product) => sum + product.variants.length, 0);
  return { products: deduped, duplicateOffersSkipped: offersBefore - offersAfter };
}
function countVariants(products) {
  return products.reduce((sum, product) => sum + product.variants.length, 0);
}
function validVariants(product) {
  return product.variants.filter((variant) => variant.offer.pricePerKgCents >= 0 && variant.totalWeightGrams > 0);
}
async function runRetailerAdapter(adapter, options = {}) {
  const retailer = adapter.identify();
  const dryRun = options.dryRun ?? true;
  const now = options.now ?? /* @__PURE__ */ new Date();
  const startedAt = /* @__PURE__ */ new Date();
  const logger = options.logger ?? createStructuredLogger({ retailerKey: retailer.key });
  const http = options.http ?? createDealHttpClient();
  const maxConcurrency = options.maxConcurrency ?? 3;
  const errors = [];
  let rawProducts = 0;
  let normalizedProducts = [];
  logger.info("dealtracker_adapter_started", { dryRun, adapterType: retailer.adapterType });
  try {
    const overview = await adapter.fetchProductOverview({ now, dryRun, http, logger });
    const parsedOverview = await adapter.parseProductOverview(overview, { now, dryRun, http, logger });
    rawProducts = parsedOverview.length;
    const maybeProducts = await mapWithConcurrency(parsedOverview, maxConcurrency, async (rawProduct) => {
      try {
        let product = rawProduct;
        if (adapter.fetchProductDetails && adapter.parseProductDetails) {
          try {
            const details = await adapter.fetchProductDetails(rawProduct, { now, dryRun, http, logger });
            product = await adapter.parseProductDetails(rawProduct, details, { now, dryRun, http, logger });
          } catch (error) {
            errors.push({
              retailerKey: retailer.key,
              stage: "detail_fetch",
              code: "detail_fetch_failed",
              message: errorFromUnknown(error),
              sourceId: rawProduct.sourceId,
              detailUrl: rawProduct.detailUrl,
              retryable: true
            });
            return null;
          }
        }
        const normalized = await adapter.normalizeProduct(product, { now, dryRun, http, logger });
        const variants = validVariants(normalized);
        if (!variants.length) throw new Error("Geen geldige aanbiedingen na normalisatie.");
        return { ...normalized, variants };
      } catch (error) {
        errors.push({
          retailerKey: retailer.key,
          stage: "normalize",
          code: "product_normalize_failed",
          message: errorFromUnknown(error),
          sourceId: rawProduct.sourceId,
          detailUrl: rawProduct.detailUrl,
          retryable: false
        });
        return null;
      }
    });
    normalizedProducts = maybeProducts.filter((product) => product !== null);
  } catch (error) {
    errors.push({
      retailerKey: retailer.key,
      stage: "overview_fetch",
      code: "overview_failed",
      message: errorFromUnknown(error),
      retryable: true
    });
  }
  const deduped = dedupeProducts(normalizedProducts);
  const finishedAt = /* @__PURE__ */ new Date();
  const fatalErrors = rawProducts === 0 && errors.length > 0 ? errors.length : 0;
  const summary = {
    retailerKey: retailer.key,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    dryRun,
    productsSeen: rawProducts,
    productsNormalized: deduped.products.length,
    variantsNormalized: countVariants(deduped.products),
    offersNormalized: countVariants(deduped.products),
    duplicateOffersSkipped: deduped.duplicateOffersSkipped,
    productErrors: errors.length - fatalErrors,
    fatalErrors
  };
  logger.info("dealtracker_adapter_finished", {
    dryRun,
    productsSeen: summary.productsSeen,
    productsNormalized: summary.productsNormalized,
    errors: errors.length
  });
  return {
    retailer,
    products: deduped.products,
    errors,
    summary
  };
}

// src/services/dealtracker/adapters/JoybuyAdapter.ts
var JOYBUY_DOMAIN = "www.joybuy.nl";
var MATERIAL_PATTERN = /\bPLA\s*(?:\+|PLUS|BASIC|BIO|SILK|MATTE|MATT|META|HS|HIGH SPEED)?\b/i;
var PLA_PLUS_PATTERN = /\bPLA\s*\+|\bPLA\s*(?:PLUS|BIO)\b/i;
function parseDelimited(value) {
  const delimiter = value.includes("	") ? "	" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && character === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += character;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = (rows.shift() ?? []).map((header) => header.trim().toLowerCase());
  return rows.filter((cells) => cells.some((item) => item.trim())).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""])));
}
function field(row, names) {
  for (const name of names) {
    const value = row[name.toLowerCase()];
    if (value) return value.trim();
  }
  return "";
}
function parseMoneyCents(value) {
  const normalized = value.replace(/\bEUR\b/gi, "").replace(/[€\s]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return euroToCents(parsed);
}
function parseWeightGrams(text) {
  const multipack = text.match(/\b(\d{1,2})\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|kilogram|g|gram)\b/i);
  if (multipack) {
    const count = Number.parseInt(multipack[1], 10);
    const weight = Number.parseFloat(multipack[2].replace(",", "."));
    if (Number.isFinite(count) && Number.isFinite(weight) && count > 0 && weight > 0) {
      const grams = /kg|kilogram/i.test(multipack[3]) ? weight * 1e3 : weight;
      return Math.round(count * grams);
    }
  }
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilogram|g|gram)\b/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  return /kg|kilogram/i.test(match[2]) ? Math.round(value * 1e3) : Math.round(value);
}
function parseSpoolCount(text) {
  const explicit = text.match(/\b(\d{1,2})\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:kg|g|gram)\b/i) ?? text.match(/\bset\s*(?:van)?\s*(\d{1,2})\b/i) ?? text.match(/\b(\d{1,2})\s*(?:rollen|spoelen|spools)\b/i);
  return explicit ? Math.max(1, Number.parseInt(explicit[1], 10)) : 1;
}
function parseDiameterMm(text) {
  const match = text.match(/(\d(?:[.,]\d{1,2})?)\s*mm\b/i);
  if (!match) return void 0;
  const value = Number.parseFloat(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : void 0;
}
function parseColor(text) {
  const known = text.match(/\b(zwart|wit|blauw|groen|rood|geel|oranje|brons|goud|zilver|grijs|textuurgrijs|transparant|cyaan|rainbow|regenboog|multicolor|paars|roze|bruin)\b/i)?.[1];
  if (known) return known.trim();
  const afterSlash = text.match(/\/\s*([^/|,-]+)\s*(?:$|[|,-])/i)?.[1];
  const afterDash = text.match(/-\s*([^-/|]+)$/)?.[1];
  return (afterSlash || afterDash || "Onbekend").trim();
}
function parseStock(value) {
  const normalized = value.toLowerCase();
  if (/out|uitverkocht|niet op voorraad/.test(normalized)) return "uitverkocht";
  if (/preorder|voorverkoop/.test(normalized)) return "preorder";
  if (/backorder|nabesteld/.test(normalized)) return "backorder";
  if (/in stock|op voorraad|beschikbaar|vandaag|morgen/.test(normalized)) return "op voorraad";
  return "unknown";
}
function stableId(row) {
  return field(row, ["id", "g:id", "aw_product_id", "product_id", "item_group_id", "sku"]) || field(row, ["link", "deeplink", "product_url"]).replace(/^https?:\/\//i, "").replace(/[?#].*$/, "");
}
function stableHash(value) {
  const serialized = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
function shippingFromRow(row) {
  const explicit = field(row, ["shipping_price", "delivery_cost", "shipping_cost", "verzendkosten"]);
  if (explicit) {
    const cents = parseMoneyCents(explicit);
    if (cents !== null) return { known: true, cents };
  }
  const googleShipping = field(row, ["shipping", "g:shipping"]);
  if (googleShipping) {
    const cents = parseMoneyCents(googleShipping);
    if (cents !== null) return { known: true, cents };
  }
  return { known: false, cents: 0 };
}
function rowText(row) {
  return [
    field(row, ["title", "product_name", "name"]),
    field(row, ["description"]),
    field(row, ["product_type", "google_product_category", "category"])
  ].join(" ");
}
function isJoybuyNlUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname === JOYBUY_DOMAIN || url.hostname === "joybuy.nl";
  } catch {
    return false;
  }
}
function isPlaProduct(row) {
  return MATERIAL_PATTERN.test(rowText(row));
}
var JoybuyAdapter = class {
  feedUrl;
  feedText;
  constructor(options = {}) {
    this.feedUrl = options.feedUrl;
    this.feedText = options.feedText;
  }
  identify() {
    return {
      key: "joybuy-nl",
      name: "Joybuy",
      domain: JOYBUY_DOMAIN,
      countryCode: "NL",
      adapterType: "affiliate_feed"
    };
  }
  async fetchProductOverview(context) {
    if (this.feedText !== void 0) return this.feedText;
    if (!this.feedUrl) throw new Error("Joybuy feedUrl ontbreekt.");
    return context.http.fetchText(this.feedUrl, {
      timeoutMs: 15e3,
      acceptedContentTypes: ["text/csv", "text/plain", "text/tab-separated-values", "application/octet-stream"],
      maxResponseBytes: 5e6
    });
  }
  async parseProductOverview(source) {
    if (typeof source !== "string") throw new Error("Joybuy feed moet tekst zijn.");
    return parseDelimited(source).filter((row) => isPlaProduct(row)).map((row) => ({
      sourceId: stableId(row),
      detailUrl: field(row, ["link", "deeplink", "product_url"]),
      payload: row
    })).filter((product) => product.sourceId && product.detailUrl);
  }
  async normalizeProduct(product, context) {
    const row = product.payload;
    const text = rowText(row);
    const url = field(row, ["link", "deeplink", "product_url"]);
    if (!isJoybuyNlUrl(url)) throw new Error("Productlink is geen Joybuy NL URL.");
    const priceCents = parseMoneyCents(field(row, ["sale_price", "price", "search_price"]));
    if (priceCents === null) throw new Error("Ongeldige of ontbrekende prijs.");
    const normalPriceCents = parseMoneyCents(field(row, ["rrp_price", "normal_price", "old_price", "price_before_discount"]));
    const directDiscountCents = normalPriceCents !== null && normalPriceCents > priceCents ? normalPriceCents - priceCents : 0;
    const shipping = shippingFromRow(row);
    const spoolCount = parseSpoolCount(text);
    const totalWeight = parseWeightGrams(text);
    const spoolWeightGrams = totalWeight ? Math.round(totalWeight / spoolCount) : null;
    const material = normalizeMaterialName(PLA_PLUS_PATTERN.test(text) ? "PLA+" : "PLA");
    const stockValue = field(row, ["availability", "stock_status", "availability_text", "delivery_time"]);
    const validation = validateDealOffer({
      productPrice: centsToEuro(priceCents),
      normalPrice: normalPriceCents === null ? null : centsToEuro(normalPriceCents),
      directDiscount: centsToEuro(directDiscountCents),
      shippingCost: centsToEuro(shipping.cents),
      spoolWeightGrams,
      spoolCount,
      stockStatus: parseStock(stockValue),
      material
    });
    if (!validation.accepted || !validation.pricing) {
      throw new Error(`Aanbieding afgewezen: ${validation.errors.join(", ")}`);
    }
    const color = parseColor(text);
    const variantKey = [
      field(row, ["item_group_id", "g:item_group_id"]),
      field(row, ["sku", "mpn", "g:mpn"]),
      color,
      validation.pricing.totalWeightGrams
    ].filter(Boolean).join("|").toLowerCase();
    const offer = {
      offerKey: `${product.sourceId}:${variantKey}`,
      productPriceCents: validation.pricing.productPriceCents,
      normalPriceCents,
      directDiscountCents,
      shippingCostKnown: shipping.known,
      shippingCostCents: shipping.cents,
      totalPriceCents: validation.pricing.totalPriceCents,
      pricePerKgCents: validation.pricing.pricePerKgCents,
      currency: "EUR",
      stockStatus: validation.pricing.stockStatus,
      checkedAt: context.now.toISOString(),
      sourceHash: stableHash({
        sourceId: product.sourceId,
        variantKey,
        price: validation.pricing.productPriceCents,
        normalPrice: normalPriceCents,
        discount: directDiscountCents,
        shippingKnown: shipping.known,
        shipping: shipping.cents,
        stock: validation.pricing.stockStatus
      })
    };
    const variant = {
      variantKey,
      variantSourceId: field(row, ["id", "g:id", "aw_product_id", "product_id"]),
      sku: field(row, ["sku", "mpn", "g:mpn"]) || void 0,
      color,
      spoolWeightGrams: spoolWeightGrams ?? 0,
      spoolCount,
      totalWeightGrams: resolveTotalWeightGrams({ totalWeightGrams: validation.pricing.totalWeightGrams }),
      offer
    };
    return {
      retailerKey: this.identify().key,
      sourceId: product.sourceId,
      productName: field(row, ["title", "product_name", "name"]),
      brand: field(row, ["brand", "manufacturer"]) || "Joybuy",
      material,
      productUrl: url,
      imageUrl: field(row, ["image_link", "image_url", "aw_image_url"]) || void 0,
      diameterMm: parseDiameterMm(text),
      active: true,
      variants: [variant]
    };
  }
};

// src/services/dealtracker/adapterRegistry.ts
function stringConfig(config, key) {
  const value = config[key];
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function createRetailerAdapter(retailer) {
  if (retailer.adapterKey === "joybuy-nl" || retailer.domain === "www.joybuy.nl" || retailer.domain === "joybuy.nl") {
    return new JoybuyAdapter({
      feedUrl: stringConfig(retailer.config, "feedUrl"),
      feedText: stringConfig(retailer.config, "feedText")
    });
  }
  return null;
}

// src/services/dealtracker/scrapeOrchestrator.ts
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
async function runDealtracker(repository, options) {
  const logger = options.logger ?? createStructuredLogger({ process: "dealtracker" });
  const runId = await repository.createRun(options);
  const totals = {
    retailersTotal: 0,
    retailersSucceeded: 0,
    retailersFailed: 0,
    offersSeen: 0,
    observationsInserted: 0
  };
  const startedAt = Date.now();
  let hadPartialRetailer = false;
  const locked = await repository.acquireRunLock(runId, options.maxRuntimeMs);
  if (!locked) {
    const exitReason = "Een andere dealtracker-run is al actief.";
    await repository.finishRun(runId, "failed", 75, exitReason, totals);
    return { runId, status: "failed", exitCode: 75, exitReason, totals };
  }
  try {
    await repository.markRunRunning(runId);
    const retailers = await repository.listActiveRetailers(options.retailerFilter);
    totals.retailersTotal = retailers.length;
    if (!retailers.length) {
      const exitReason2 = options.retailerFilter ? "Geen actieve retailer gevonden voor filter." : "Geen actieve retailers gevonden.";
      await repository.finishRun(runId, "failed", 66, exitReason2, totals);
      return { runId, status: "failed", exitCode: 66, exitReason: exitReason2, totals };
    }
    for (const retailer of retailers) {
      if (Date.now() - startedAt >= options.maxRuntimeMs) {
        const timeoutError = [{
          retailerKey: retailer.adapterKey,
          stage: "overview_fetch",
          code: "run_timeout",
          message: "Maximale runtime bereikt voor deze retailer kon starten.",
          retryable: true
        }];
        await repository.recordErrors(runId, retailer, timeoutError);
        totals.retailersFailed += 1;
        continue;
      }
      const adapter = createRetailerAdapter(retailer);
      await repository.startRetailerRun(runId, retailer);
      if (!adapter) {
        const errors = [{
          retailerKey: retailer.adapterKey,
          stage: "overview_fetch",
          code: "adapter_not_found",
          message: `Geen actieve adapter gevonden voor ${retailer.adapterKey}.`,
          retryable: false
        }];
        await repository.recordErrors(runId, retailer, errors);
        await repository.finishRetailerRun(runId, retailer, "skipped", {
          retailerKey: retailer.adapterKey,
          startedAt: (/* @__PURE__ */ new Date()).toISOString(),
          finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
          durationMs: 0,
          dryRun: options.dryRun,
          productsSeen: 0,
          productsNormalized: 0,
          variantsNormalized: 0,
          offersNormalized: 0,
          duplicateOffersSkipped: 0,
          productErrors: 0,
          fatalErrors: 1
        }, { offersSeen: 0, observationsInserted: 0 });
        totals.retailersFailed += 1;
        continue;
      }
      try {
        const result = await runRetailerAdapter(adapter, {
          dryRun: options.dryRun,
          now: /* @__PURE__ */ new Date(),
          logger,
          maxConcurrency: Math.min(3, retailer.maxConcurrency),
          http: createDealHttpClient({
            timeoutMs: retailer.requestTimeoutMs,
            retries: 2,
            retryBaseDelayMs: 500,
            rateLimitMs: retailer.requestDelayMs,
            maxResponseBytes: 5e6
          })
        });
        const limitedProducts = options.maxProducts ? result.products.slice(0, options.maxProducts) : result.products;
        const writeResult = await repository.writeRetailerProducts(runId, retailer, limitedProducts, options);
        await repository.recordErrors(runId, retailer, result.errors);
        const retailerStatus = result.summary.fatalErrors > 0 ? "failed" : result.errors.length > 0 ? "partial" : "completed";
        await repository.finishRetailerRun(runId, retailer, retailerStatus, result.summary, writeResult);
        totals.offersSeen += writeResult.offersSeen;
        totals.observationsInserted += writeResult.observationsInserted;
        if (retailerStatus === "failed") totals.retailersFailed += 1;
        else {
          totals.retailersSucceeded += 1;
          if (retailerStatus === "partial") hadPartialRetailer = true;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Onbekende retailerfout.";
        await repository.recordErrors(runId, retailer, [{
          retailerKey: retailer.adapterKey,
          stage: "overview_fetch",
          code: "retailer_run_failed",
          message,
          retryable: true
        }]);
        await repository.finishRetailerRun(runId, retailer, "failed", {
          retailerKey: retailer.adapterKey,
          startedAt: (/* @__PURE__ */ new Date()).toISOString(),
          finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
          durationMs: 0,
          dryRun: options.dryRun,
          productsSeen: 0,
          productsNormalized: 0,
          variantsNormalized: 0,
          offersNormalized: 0,
          duplicateOffersSkipped: 0,
          productErrors: 0,
          fatalErrors: 1
        }, { offersSeen: 0, observationsInserted: 0 });
        totals.retailersFailed += 1;
      }
      if (retailer.requestDelayMs > 0) await sleep(Math.min(retailer.requestDelayMs, 1e4));
    }
    const status = totals.retailersSucceeded === totals.retailersTotal && !hadPartialRetailer ? "completed" : totals.retailersSucceeded > 0 ? "partial" : "failed";
    const exitCode = status === "completed" ? 0 : status === "partial" ? 2 : 1;
    const exitReason = status === "completed" ? "Alle retailers succesvol verwerkt." : status === "partial" ? "Minimaal een retailer faalde." : "Geen retailer succesvol verwerkt.";
    await repository.finishRun(runId, status, exitCode, exitReason, totals);
    return { runId, status, exitCode, exitReason, totals };
  } finally {
    await repository.releaseRunLock(runId);
  }
}

// api/dealtracker-run.ts
function first2(value) {
  return Array.isArray(value) ? value[0] : value;
}
function bodyRecord(body) {
  return body && typeof body === "object" && !Array.isArray(body) ? body : {};
}
function booleanValue(value) {
  return value === true || value === "true" || value === "1";
}
function numberValue2(value, fallback) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function bearerToken(request) {
  const header = first2(request.headers.authorization);
  return header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
}
function isAuthorized(request) {
  const expected = process.env.DEALTRACKER_RUN_SECRET || process.env.CRON_SECRET;
  if (!expected) return false;
  const headerSecret = first2(request.headers["x-dealtracker-secret"]);
  return bearerToken(request) === expected || headerSecret === expected;
}
async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(request.method ?? "")) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Methode niet toegestaan." });
  }
  if (!isAuthorized(request)) return response.status(401).json({ error: "Ongeldige dealtracker-secret." });
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return response.status(503).json({ error: "Supabase servicecontext ontbreekt." });
  }
  const body = bodyRecord(request.body);
  const retailer = first2(request.query.retailer) ?? (typeof body.retailer === "string" ? body.retailer : void 0);
  const dryRun = booleanValue(first2(request.query.dryRun) ?? body.dryRun);
  const validateOnly = booleanValue(first2(request.query.validateOnly) ?? body.validateOnly);
  const maxProducts = numberValue2(first2(request.query.maxProducts) ?? body.maxProducts, 0) || void 0;
  const maxRuntimeMs = numberValue2(first2(request.query.maxRuntimeMs) ?? body.maxRuntimeMs, 24e4);
  try {
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const result = await runDealtracker(new SupabaseDealtrackerRepository(client), {
      dryRun,
      validateOnly,
      retailerFilter: retailer,
      maxProducts,
      maxRuntimeMs,
      triggerSource: "api",
      logger: createStructuredLogger({ endpoint: "api/dealtracker-run" })
    });
    const appBaseUrl = process.env.HAZALI_APP_URL || first2(request.headers.origin) || "";
    const alertResult = !dryRun && !validateOnly && appBaseUrl ? await evaluateDealAlerts(client, result.runId, appBaseUrl) : null;
    return response.status(result.exitCode === 0 ? 200 : result.exitCode === 2 ? 207 : 500).json({ ...result, alertResult });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : "Dealtracker-run mislukt."
    });
  }
}
export {
  handler as default
};
