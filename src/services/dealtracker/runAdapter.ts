import { createDealHttpClient } from "./httpClient.ts";
import { createStructuredLogger } from "./logger.ts";
import type {
  AdapterError,
  AdapterResult,
  NormalizedFilamentProduct,
  NormalizedVariant,
  RetailerAdapter,
  RunAdapterOptions,
} from "./adapterTypes.ts";

function errorFromUnknown(error: unknown) {
  return error instanceof Error ? error.message : "Onbekende fout.";
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
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

function dedupeProducts(products: NormalizedFilamentProduct[]) {
  const duplicateOfferKeys = new Set<string>();
  const mergedProducts = new Map<string, NormalizedFilamentProduct>();

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

function countVariants(products: NormalizedFilamentProduct[]) {
  return products.reduce((sum, product) => sum + product.variants.length, 0);
}

function validVariants(product: NormalizedFilamentProduct): NormalizedVariant[] {
  return product.variants.filter((variant) => variant.offer.pricePerKgCents >= 0 && variant.totalWeightGrams > 0);
}

export async function runRetailerAdapter(adapter: RetailerAdapter, options: RunAdapterOptions = {}): Promise<AdapterResult> {
  const retailer = adapter.identify();
  const dryRun = options.dryRun ?? true;
  const now = options.now ?? new Date();
  const startedAt = new Date();
  const logger = options.logger ?? createStructuredLogger({ retailerKey: retailer.key });
  const http = options.http ?? createDealHttpClient();
  const maxConcurrency = options.maxConcurrency ?? 3;
  const errors: AdapterError[] = [];
  let rawProducts = 0;
  let normalizedProducts: NormalizedFilamentProduct[] = [];

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
              retryable: true,
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
          retryable: false,
        });
        return null;
      }
    });

    normalizedProducts = maybeProducts.filter((product): product is NormalizedFilamentProduct => product !== null);
  } catch (error) {
    errors.push({
      retailerKey: retailer.key,
      stage: "overview_fetch",
      code: "overview_failed",
      message: errorFromUnknown(error),
      retryable: true,
    });
  }

  const deduped = dedupeProducts(normalizedProducts);
  const finishedAt = new Date();
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
    fatalErrors,
  };

  logger.info("dealtracker_adapter_finished", {
    dryRun,
    productsSeen: summary.productsSeen,
    productsNormalized: summary.productsNormalized,
    errors: errors.length,
  });

  return {
    retailer,
    products: deduped.products,
    errors,
    summary,
  };
}
