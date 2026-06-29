import type { JsonValue } from "../../../types/Dealtracker.ts";
import {
  centsToEuro,
  normalizeMaterialName,
  resolveTotalWeightGrams,
  validateDealOffer,
} from "../../../utils/dealPricing.ts";
import type {
  AdapterContext,
  NormalizedFilamentProduct,
  NormalizedOffer,
  NormalizedVariant,
  RawRetailerProduct,
  RetailerAdapter,
} from "../adapterTypes.ts";

type MockFixtureProduct = {
  sourceId: string;
  productName: string;
  brand: string;
  material: string;
  productUrl: string;
  imageUrl?: string;
  diameterMm?: number;
  variants: MockFixtureVariant[];
};

type MockFixtureVariant = {
  variantSourceId?: string;
  sku?: string;
  color: string;
  spoolWeightGrams?: number;
  spoolCount?: number;
  productPrice: number;
  normalPrice?: number;
  directDiscount?: number;
  shippingCost?: number;
  stockStatus?: string;
};

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: JsonValue | undefined): string;
function asString(value: JsonValue | undefined, fallback: string): string;
function asString(value: JsonValue | undefined, fallback: undefined): string | undefined;
function asString(value: JsonValue | undefined, fallback: string | undefined = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: JsonValue | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asArray(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function parseProduct(value: JsonValue): MockFixtureProduct {
  if (!isRecord(value)) throw new Error("Productfixture is ongeldig.");
  const variants = asArray(value.variants).map((variant): MockFixtureVariant => {
    if (!isRecord(variant)) throw new Error("Variantfixture is ongeldig.");
    return {
      variantSourceId: asString(variant.variantSourceId, undefined),
      sku: asString(variant.sku, undefined),
      color: asString(variant.color, "Onbekend"),
      spoolWeightGrams: asNumber(variant.spoolWeightGrams),
      spoolCount: asNumber(variant.spoolCount),
      productPrice: asNumber(variant.productPrice) ?? Number.NaN,
      normalPrice: asNumber(variant.normalPrice),
      directDiscount: asNumber(variant.directDiscount),
      shippingCost: asNumber(variant.shippingCost),
      stockStatus: asString(variant.stockStatus, "unknown"),
    };
  });

  return {
    sourceId: asString(value.sourceId),
    productName: asString(value.productName),
    brand: asString(value.brand, "Onbekend"),
    material: asString(value.material, "UNKNOWN"),
    productUrl: asString(value.productUrl),
    imageUrl: asString(value.imageUrl, undefined),
    diameterMm: asNumber(value.diameterMm),
    variants,
  };
}

function stableHash(value: JsonValue | Record<string, JsonValue>) {
  const serialized = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function variantKey(variant: MockFixtureVariant) {
  return [
    variant.variantSourceId,
    variant.sku,
    variant.color,
    variant.spoolWeightGrams,
    variant.spoolCount,
  ].filter((value) => value !== undefined && value !== "").join("|").toLowerCase();
}

export class MockRetailerAdapter implements RetailerAdapter {
  private readonly fixtureSource: JsonValue | string;

  constructor(fixtureSource: JsonValue | string) {
    this.fixtureSource = fixtureSource;
  }

  identify() {
    return {
      key: "mock-retailer",
      name: "Mock Filament Shop",
      domain: "mock.hazali.local",
      countryCode: "NL",
      adapterType: "product_feed" as const,
    };
  }

  async fetchProductOverview() {
    return this.fixtureSource;
  }

  async parseProductOverview(source: JsonValue | string): Promise<RawRetailerProduct[]> {
    const parsed = typeof source === "string" ? JSON.parse(source) as JsonValue : source;
    if (!isRecord(parsed)) throw new Error("Mockfixture mist een object-root.");
    const products = asArray(parsed.products);
    return products.map((product) => {
      const parsedProduct = parseProduct(product);
      return {
        sourceId: parsedProduct.sourceId,
        detailUrl: parsedProduct.productUrl,
        payload: product,
      };
    });
  }

  async normalizeProduct(product: RawRetailerProduct, context: AdapterContext): Promise<NormalizedFilamentProduct> {
    const parsed = parseProduct(product.payload);
    const material = normalizeMaterialName(parsed.material);
    const variants: NormalizedVariant[] = [];

    for (const fixtureVariant of parsed.variants) {
      const validation = validateDealOffer({
        productPrice: fixtureVariant.productPrice,
        normalPrice: fixtureVariant.normalPrice,
        directDiscount: fixtureVariant.directDiscount,
        shippingCost: fixtureVariant.shippingCost,
        spoolWeightGrams: fixtureVariant.spoolWeightGrams,
        spoolCount: fixtureVariant.spoolCount,
        stockStatus: fixtureVariant.stockStatus,
        material: parsed.material,
      });

      if (!validation.accepted || !validation.pricing) {
        context.logger.warn("mock_variant_rejected", {
          sourceId: parsed.sourceId,
          variant: fixtureVariant.variantSourceId ?? fixtureVariant.sku ?? fixtureVariant.color,
          errors: validation.errors,
        });
        continue;
      }

      const normalizedVariantKey = variantKey(fixtureVariant);
      const offer: NormalizedOffer = {
        offerKey: `${parsed.sourceId}:${normalizedVariantKey}`,
        productPriceCents: validation.pricing.productPriceCents,
        normalPriceCents: validation.pricing.normalPriceCents,
        directDiscountCents: validation.pricing.directDiscountCents,
        shippingCostKnown: true,
        shippingCostCents: validation.pricing.shippingCostCents,
        totalPriceCents: validation.pricing.totalPriceCents,
        pricePerKgCents: validation.pricing.pricePerKgCents,
        currency: "EUR",
        stockStatus: validation.pricing.stockStatus,
        checkedAt: context.now.toISOString(),
        sourceHash: stableHash({
          sourceId: parsed.sourceId,
          variantKey: normalizedVariantKey,
          totalPrice: centsToEuro(validation.pricing.totalPriceCents),
          pricePerKg: centsToEuro(validation.pricing.pricePerKgCents),
          stockStatus: validation.pricing.stockStatus,
        }),
      };

      variants.push({
        variantKey: normalizedVariantKey,
        variantSourceId: fixtureVariant.variantSourceId,
        sku: fixtureVariant.sku,
        color: fixtureVariant.color,
        spoolWeightGrams: fixtureVariant.spoolWeightGrams ?? 0,
        spoolCount: fixtureVariant.spoolCount ?? 1,
        totalWeightGrams: resolveTotalWeightGrams(fixtureVariant),
        offer,
      });
    }

    return {
      retailerKey: this.identify().key,
      sourceId: parsed.sourceId,
      productName: parsed.productName,
      brand: parsed.brand,
      material,
      productUrl: parsed.productUrl,
      imageUrl: parsed.imageUrl,
      diameterMm: parsed.diameterMm,
      active: variants.length > 0,
      variants,
    };
  }
}
