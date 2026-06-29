export type DealAdapterType = "api" | "product_feed" | "affiliate_feed" | "html";

export type DealStockStatus = "in_stock" | "out_of_stock" | "backorder" | "preorder" | "unknown";

export type DealRunStatus = "pending" | "running" | "completed" | "partial" | "failed";

export type DealNotificationStatus = "pending" | "sent" | "failed" | "skipped";

export type DealMaterial = "PLA" | "PLA+" | "PETG" | "ABS" | "TPU" | "ASA" | "PA" | "PC" | "UNKNOWN";

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type DealRetailer = {
  id: string;
  name: string;
  domain: string;
  country_code: string;
  active: boolean;
  adapter_type: DealAdapterType;
  adapter_key: string;
  last_successful_check_at: string | null;
  config: Record<string, JsonValue>;
  request_delay_ms: number;
  request_timeout_ms: number;
  max_concurrency: number;
  created_at: string;
  updated_at: string;
};

export type DealProduct = {
  id: string;
  retailer_id: string;
  source_id: string;
  product_name: string;
  brand: string;
  material: DealMaterial | string;
  product_url: string;
  image_url: string | null;
  diameter_mm: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type DealProductVariant = {
  id: string;
  product_id: string;
  variant_key: string;
  variant_source_id: string | null;
  sku: string | null;
  color: string;
  spool_weight_grams: number;
  spool_count: number;
  total_weight_grams: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type DealOffer = {
  id: string;
  variant_id: string;
  product_price: number;
  normal_price: number | null;
  direct_discount: number;
  shipping_cost_known: boolean;
  shipping_cost: number;
  total_price: number;
  price_per_kg: number;
  currency: string;
  stock_status: DealStockStatus;
  checked_at: string;
  source_hash: string | null;
  created_at: string;
  updated_at: string;
};

export type DealPriceObservation = {
  id: string;
  offer_id: string;
  product_price: number;
  normal_price: number | null;
  direct_discount: number;
  shipping_cost_known: boolean;
  shipping_cost: number;
  total_price: number;
  price_per_kg: number;
  currency: string;
  stock_status: DealStockStatus;
  checked_at: string;
  observation_hash: string;
  created_at: string;
};

export type DealTrackerRule = {
  id: string;
  user_id: string;
  product_id: string | null;
  material: DealMaterial | string;
  brand: string | null;
  retailer_id: string | null;
  max_price_per_kg: number;
  min_spool_weight_grams: number;
  min_total_weight_grams: number;
  in_stock_only: boolean;
  require_known_shipping: boolean;
  active: boolean;
  label: string | null;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DealScrapeRun = {
  id: string;
  status: DealRunStatus;
  trigger_source: string;
  started_at: string;
  finished_at: string | null;
  dry_run: boolean;
  validate_only: boolean;
  retailer_filter: string | null;
  max_products: number | null;
  exit_code: number | null;
  exit_reason: string | null;
  retailers_total: number;
  retailers_succeeded: number;
  retailers_failed: number;
  offers_seen: number;
  observations_inserted: number;
  created_at: string;
  updated_at: string;
};

export type DealScrapeRunRetailer = {
  id: string;
  run_id: string;
  retailer_id: string | null;
  adapter_key: string;
  status: DealRunStatus | "skipped";
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number;
  products_seen: number;
  products_normalized: number;
  variants_normalized: number;
  offers_normalized: number;
  duplicate_offers_skipped: number;
  observations_inserted: number;
  product_errors: number;
  fatal_errors: number;
  dry_run: boolean;
  created_at: string;
  updated_at: string;
};

export type DealScrapeRunError = {
  id: string;
  run_id: string;
  retailer_id: string | null;
  adapter_key: string;
  error_code: string;
  message: string;
  details: Record<string, JsonValue>;
  created_at: string;
};

export type DealAlertEvent = {
  id: string;
  user_id: string;
  tracker_rule_id: string;
  offer_id: string;
  price_observation_id: string | null;
  scrape_run_id: string | null;
  event_key: string;
  price_per_kg: number;
  previous_price_per_kg: number | null;
  reason: string;
  notification_status: DealNotificationStatus;
  email_to: string | null;
  email_subject: string | null;
  email_error: string | null;
  created_at: string;
  sent_at: string | null;
  seen_at: string | null;
};
