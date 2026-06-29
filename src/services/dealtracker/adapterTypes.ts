import type { DealAdapterType, DealMaterial, DealStockStatus, JsonValue } from "../../types/Dealtracker.ts";

export type RetailerIdentity = {
  key: string;
  name: string;
  domain: string;
  countryCode: string;
  adapterType: DealAdapterType;
};

export type RawRetailerProduct = {
  sourceId: string;
  detailUrl?: string;
  payload: JsonValue;
};

export type NormalizedOffer = {
  offerKey: string;
  productPriceCents: number;
  normalPriceCents: number | null;
  directDiscountCents: number;
  shippingCostKnown: boolean;
  shippingCostCents: number;
  totalPriceCents: number;
  pricePerKgCents: number;
  currency: "EUR";
  stockStatus: DealStockStatus;
  checkedAt: string;
  sourceHash: string;
};

export type NormalizedVariant = {
  variantKey: string;
  variantSourceId?: string;
  sku?: string;
  color: string;
  spoolWeightGrams: number;
  spoolCount: number;
  totalWeightGrams: number;
  offer: NormalizedOffer;
};

export type NormalizedFilamentProduct = {
  retailerKey: string;
  sourceId: string;
  productName: string;
  brand: string;
  material: DealMaterial;
  productUrl: string;
  imageUrl?: string;
  diameterMm?: number;
  active: boolean;
  variants: NormalizedVariant[];
};

export type AdapterErrorStage = "overview_fetch" | "overview_parse" | "detail_fetch" | "detail_parse" | "normalize" | "dedupe";

export type AdapterError = {
  retailerKey: string;
  stage: AdapterErrorStage;
  code: string;
  message: string;
  sourceId?: string;
  detailUrl?: string;
  retryable: boolean;
};

export type ScrapeRunSummary = {
  retailerKey: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  dryRun: boolean;
  productsSeen: number;
  productsNormalized: number;
  variantsNormalized: number;
  offersNormalized: number;
  duplicateOffersSkipped: number;
  productErrors: number;
  fatalErrors: number;
};

export type AdapterResult = {
  retailer: RetailerIdentity;
  products: NormalizedFilamentProduct[];
  errors: AdapterError[];
  summary: ScrapeRunSummary;
};

export type AdapterLogger = {
  info: (message: string, fields?: Record<string, JsonValue>) => void;
  warn: (message: string, fields?: Record<string, JsonValue>) => void;
  error: (message: string, fields?: Record<string, JsonValue>) => void;
};

export type AdapterHttpClient = {
  fetchText: (url: string, options?: AdapterHttpRequestOptions) => Promise<string>;
  fetchJson: (url: string, options?: AdapterHttpRequestOptions) => Promise<JsonValue>;
};

export type AdapterHttpRequestOptions = {
  timeoutMs?: number;
  acceptedContentTypes?: string[];
  maxResponseBytes?: number;
};

export type AdapterContext = {
  now: Date;
  dryRun: boolean;
  http: AdapterHttpClient;
  logger: AdapterLogger;
};

export type RetailerAdapter = {
  identify: () => RetailerIdentity;
  fetchProductOverview: (context: AdapterContext) => Promise<JsonValue | string>;
  parseProductOverview: (source: JsonValue | string, context: AdapterContext) => Promise<RawRetailerProduct[]>;
  fetchProductDetails?: (product: RawRetailerProduct, context: AdapterContext) => Promise<JsonValue | string>;
  parseProductDetails?: (product: RawRetailerProduct, source: JsonValue | string, context: AdapterContext) => Promise<RawRetailerProduct>;
  normalizeProduct: (product: RawRetailerProduct, context: AdapterContext) => Promise<NormalizedFilamentProduct>;
};

export type RunAdapterOptions = {
  dryRun?: boolean;
  now?: Date;
  logger?: AdapterLogger;
  http?: AdapterHttpClient;
  maxConcurrency?: number;
};
