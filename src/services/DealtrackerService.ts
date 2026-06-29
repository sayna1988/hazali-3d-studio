import { supabase } from "../lib/supabase";
import type { DealMaterial, DealStockStatus } from "../types/Dealtracker";

export type DealtrackerOffer = {
  id: string;
  variantId: string;
  productId: string;
  retailerId: string;
  retailerName: string;
  retailerDomain: string;
  productName: string;
  brand: string;
  material: DealMaterial | string;
  productUrl: string;
  imageUrl: string | null;
  diameterMm: number | null;
  color: string;
  spoolWeightGrams: number;
  spoolCount: number;
  totalWeightGrams: number;
  sku: string | null;
  productPrice: number;
  normalPrice: number | null;
  directDiscount: number;
  shippingCostKnown: boolean;
  shippingCost: number;
  totalPrice: number;
  pricePerKg: number;
  currency: string;
  stockStatus: DealStockStatus;
  checkedAt: string;
  sourceHash: string | null;
};

export type DealPriceHistoryPoint = {
  id: string;
  offerId: string;
  productPrice: number;
  normalPrice: number | null;
  directDiscount: number;
  shippingCostKnown: boolean;
  shippingCost: number;
  totalPrice: number;
  pricePerKg: number;
  stockStatus: DealStockStatus;
  checkedAt: string;
};

export type DealtrackerRunInfo = {
  lastSuccessfulCheckAt: string | null;
};

export type CreateTrackerRuleInput = {
  userId: string;
  productId?: string | null;
  material: string;
  brand?: string | null;
  retailerId?: string | null;
  maxPricePerKg: number;
  minTotalWeightGrams: number;
  inStockOnly: boolean;
  requireKnownShipping: boolean;
  label?: string | null;
};

export type DealTrackerRuleView = {
  id: string;
  productId: string | null;
  material: string;
  brand: string | null;
  retailerId: string | null;
  retailerName: string | null;
  maxPricePerKg: number;
  minTotalWeightGrams: number;
  inStockOnly: boolean;
  requireKnownShipping: boolean;
  active: boolean;
  label: string | null;
  lastTriggeredAt: string | null;
  createdAt: string;
};

type RetailerJoin = {
  id?: string;
  name?: string;
  domain?: string;
};

type ProductJoin = {
  id?: string;
  retailer_id?: string;
  product_name?: string;
  brand?: string;
  material?: string;
  product_url?: string;
  image_url?: string | null;
  diameter_mm?: number | null;
  deal_retailers?: RetailerJoin | RetailerJoin[] | null;
};

type VariantJoin = {
  id?: string;
  product_id?: string;
  color?: string;
  spool_weight_grams?: number;
  spool_count?: number;
  total_weight_grams?: number;
  sku?: string | null;
  deal_products?: ProductJoin | ProductJoin[] | null;
};

type OfferRow = {
  id?: string;
  variant_id?: string;
  product_price?: number | string;
  normal_price?: number | string | null;
  direct_discount?: number | string;
  shipping_cost_known?: boolean;
  shipping_cost?: number | string;
  total_price?: number | string;
  price_per_kg?: number | string;
  currency?: string;
  stock_status?: DealStockStatus;
  checked_at?: string;
  source_hash?: string | null;
  deal_product_variants?: VariantJoin | VariantJoin[] | null;
};

type ObservationRow = {
  id?: string;
  offer_id?: string;
  product_price?: number | string;
  normal_price?: number | string | null;
  direct_discount?: number | string;
  shipping_cost_known?: boolean;
  shipping_cost?: number | string;
  total_price?: number | string;
  price_per_kg?: number | string;
  stock_status?: DealStockStatus;
  checked_at?: string;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function money(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapOffer(row: OfferRow): DealtrackerOffer | null {
  const variant = first(row.deal_product_variants);
  const product = first(variant?.deal_products);
  const retailer = first(product?.deal_retailers);
  if (!row.id || !variant?.id || !product?.id || !retailer?.id) return null;

  return {
    id: row.id,
    variantId: variant.id,
    productId: product.id,
    retailerId: retailer.id,
    retailerName: retailer.name ?? "Onbekende winkel",
    retailerDomain: retailer.domain ?? "",
    productName: product.product_name ?? "Onbekend filament",
    brand: product.brand ?? "Onbekend",
    material: product.material ?? "UNKNOWN",
    productUrl: product.product_url ?? "#",
    imageUrl: product.image_url ?? null,
    diameterMm: product.diameter_mm ?? null,
    color: variant.color ?? "Onbekend",
    spoolWeightGrams: Number(variant.spool_weight_grams ?? 0),
    spoolCount: Number(variant.spool_count ?? 1),
    totalWeightGrams: Number(variant.total_weight_grams ?? 0),
    sku: variant.sku ?? null,
    productPrice: money(row.product_price),
    normalPrice: row.normal_price === null || row.normal_price === undefined ? null : money(row.normal_price),
    directDiscount: money(row.direct_discount),
    shippingCostKnown: Boolean(row.shipping_cost_known),
    shippingCost: money(row.shipping_cost),
    totalPrice: money(row.total_price),
    pricePerKg: money(row.price_per_kg),
    currency: row.currency ?? "EUR",
    stockStatus: row.stock_status ?? "unknown",
    checkedAt: row.checked_at ?? new Date(0).toISOString(),
    sourceHash: row.source_hash ?? null,
  };
}

export async function loadDealtrackerOffers(): Promise<DealtrackerOffer[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("deal_offers")
    .select(`
      id,
      variant_id,
      product_price,
      normal_price,
      direct_discount,
      shipping_cost_known,
      shipping_cost,
      total_price,
      price_per_kg,
      currency,
      stock_status,
      checked_at,
      source_hash,
      deal_product_variants (
        id,
        product_id,
        color,
        spool_weight_grams,
        spool_count,
        total_weight_grams,
        sku,
        deal_products (
          id,
          retailer_id,
          product_name,
          brand,
          material,
          product_url,
          image_url,
          diameter_mm,
          deal_retailers (
            id,
            name,
            domain
          )
        )
      )
    `)
    .order("price_per_kg", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as OfferRow[]).map(mapOffer).filter((offer): offer is DealtrackerOffer => offer !== null);
}

export async function loadDealPriceHistory(offerId: string): Promise<DealPriceHistoryPoint[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("deal_price_observations")
    .select("id,offer_id,product_price,normal_price,direct_discount,shipping_cost_known,shipping_cost,total_price,price_per_kg,stock_status,checked_at")
    .eq("offer_id", offerId)
    .order("checked_at", { ascending: true })
    .limit(90);
  if (error) throw error;
  return ((data ?? []) as ObservationRow[]).map((row) => ({
    id: row.id ?? `${offerId}-${row.checked_at}`,
    offerId: row.offer_id ?? offerId,
    productPrice: money(row.product_price),
    normalPrice: row.normal_price === null || row.normal_price === undefined ? null : money(row.normal_price),
    directDiscount: money(row.direct_discount),
    shippingCostKnown: Boolean(row.shipping_cost_known),
    shippingCost: money(row.shipping_cost),
    totalPrice: money(row.total_price),
    pricePerKg: money(row.price_per_kg),
    stockStatus: row.stock_status ?? "unknown",
    checkedAt: row.checked_at ?? new Date(0).toISOString(),
  }));
}

export async function loadDealtrackerRunInfo(): Promise<DealtrackerRunInfo> {
  if (!supabase) return { lastSuccessfulCheckAt: null };
  const { data, error } = await supabase
    .from("deal_scrape_runs")
    .select("finished_at,status")
    .in("status", ["completed", "partial"])
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return { lastSuccessfulCheckAt: typeof data?.finished_at === "string" ? data.finished_at : null };
}

export async function createDealTrackerRule(input: CreateTrackerRuleInput) {
  if (!supabase) throw new Error("Supabase is niet geconfigureerd.");
  const { error } = await supabase.from("deal_tracker_rules").insert({
    user_id: input.userId,
    product_id: input.productId || null,
    material: input.material,
    brand: input.brand || null,
    retailer_id: input.retailerId || null,
    max_price_per_kg: input.maxPricePerKg,
    min_spool_weight_grams: input.minTotalWeightGrams,
    min_total_weight_grams: input.minTotalWeightGrams,
    in_stock_only: input.inStockOnly,
    require_known_shipping: input.requireKnownShipping,
    label: input.label || null,
    active: true,
  });
  if (error) throw error;
}

type RuleRow = {
  id?: string;
  product_id?: string | null;
  material?: string;
  brand?: string | null;
  retailer_id?: string | null;
  max_price_per_kg?: number | string;
  min_total_weight_grams?: number;
  in_stock_only?: boolean;
  require_known_shipping?: boolean;
  active?: boolean;
  label?: string | null;
  last_triggered_at?: string | null;
  created_at?: string;
  deal_retailers?: RetailerJoin | RetailerJoin[] | null;
};

function mapRule(row: RuleRow): DealTrackerRuleView | null {
  if (!row.id) return null;
  const retailer = first(row.deal_retailers);
  return {
    id: row.id,
    productId: row.product_id ?? null,
    material: row.material ?? "PLA",
    brand: row.brand ?? null,
    retailerId: row.retailer_id ?? null,
    retailerName: retailer?.name ?? null,
    maxPricePerKg: money(row.max_price_per_kg),
    minTotalWeightGrams: Number(row.min_total_weight_grams ?? 0),
    inStockOnly: Boolean(row.in_stock_only),
    requireKnownShipping: Boolean(row.require_known_shipping),
    active: Boolean(row.active),
    label: row.label ?? null,
    lastTriggeredAt: row.last_triggered_at ?? null,
    createdAt: row.created_at ?? new Date(0).toISOString(),
  };
}

export async function loadDealTrackerRules(): Promise<DealTrackerRuleView[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("deal_tracker_rules")
    .select("id,product_id,material,brand,retailer_id,max_price_per_kg,min_total_weight_grams,in_stock_only,require_known_shipping,active,label,last_triggered_at,created_at,deal_retailers(name,domain)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as RuleRow[]).map(mapRule).filter((rule): rule is DealTrackerRuleView => rule !== null);
}

export async function updateDealTrackerRule(id: string, changes: Partial<CreateTrackerRuleInput> & { active?: boolean }) {
  if (!supabase) throw new Error("Supabase is niet geconfigureerd.");
  const payload: Record<string, unknown> = {};
  if (changes.productId !== undefined) payload.product_id = changes.productId || null;
  if (changes.material !== undefined) payload.material = changes.material;
  if (changes.brand !== undefined) payload.brand = changes.brand || null;
  if (changes.retailerId !== undefined) payload.retailer_id = changes.retailerId || null;
  if (changes.maxPricePerKg !== undefined) payload.max_price_per_kg = changes.maxPricePerKg;
  if (changes.minTotalWeightGrams !== undefined) {
    payload.min_total_weight_grams = changes.minTotalWeightGrams;
    payload.min_spool_weight_grams = changes.minTotalWeightGrams;
  }
  if (changes.inStockOnly !== undefined) payload.in_stock_only = changes.inStockOnly;
  if (changes.requireKnownShipping !== undefined) payload.require_known_shipping = changes.requireKnownShipping;
  if (changes.label !== undefined) payload.label = changes.label || null;
  if (changes.active !== undefined) payload.active = changes.active;
  const { error } = await supabase.from("deal_tracker_rules").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteDealTrackerRule(id: string) {
  if (!supabase) throw new Error("Supabase is niet geconfigureerd.");
  const { error } = await supabase.from("deal_tracker_rules").delete().eq("id", id);
  if (error) throw error;
}
