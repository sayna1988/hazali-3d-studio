import type { SupabaseClient } from "@supabase/supabase-js";
import type { JsonValue } from "../../types/Dealtracker.ts";
import { centsToEuro } from "../../utils/dealPricing.ts";
import type { NormalizedFilamentProduct, AdapterError, ScrapeRunSummary } from "./adapterTypes.ts";
import type { RuntimeRetailer } from "./adapterRegistry.ts";
import type { DealtrackerRepository, RetailerWriteResult, ScrapeRunOptions, ScrapeRunTotals } from "./scrapeRepository.ts";

type RetailerRow = {
  id: string;
  name: string;
  domain: string;
  active: boolean;
  adapter_key: string;
  config: Record<string, JsonValue>;
  request_delay_ms: number;
  request_timeout_ms: number;
  max_concurrency: number;
};

type IdRow = { id: string };

function asRuntimeRetailer(row: RetailerRow): RuntimeRetailer {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    active: row.active,
    adapterKey: row.adapter_key,
    config: row.config,
    requestDelayMs: row.request_delay_ms,
    requestTimeoutMs: row.request_timeout_ms,
    maxConcurrency: row.max_concurrency,
  };
}

function countOffers(products: NormalizedFilamentProduct[]) {
  return products.reduce((sum, product) => sum + product.variants.length, 0);
}

function uniqueProducts(products: NormalizedFilamentProduct[]) {
  return [...new Map(products.map((product) => [product.sourceId, product])).values()];
}

export class SupabaseDealtrackerRepository implements DealtrackerRepository {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async createRun(options: ScrapeRunOptions) {
    const { data, error } = await this.client
      .from("deal_scrape_runs")
      .insert({
        status: "pending",
        trigger_source: options.triggerSource,
        dry_run: options.dryRun,
        validate_only: options.validateOnly,
        retailer_filter: options.retailerFilter ?? null,
        max_products: options.maxProducts ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return (data as IdRow).id;
  }

  async acquireRunLock(runId: string, maxRuntimeMs: number) {
    const expiresAt = new Date(Date.now() + maxRuntimeMs).toISOString();
    const { data: existing, error: readError } = await this.client
      .from("deal_scrape_locks")
      .select("run_id,expires_at")
      .eq("lock_name", "dealtracker")
      .maybeSingle();
    if (readError) throw readError;

    const locked = existing as { run_id: string | null; expires_at: string } | null;
    if (locked && new Date(locked.expires_at).getTime() > Date.now()) return false;

    const { error } = await this.client
      .from("deal_scrape_locks")
      .upsert({
        lock_name: "dealtracker",
        run_id: runId,
        locked_at: new Date().toISOString(),
        expires_at: expiresAt,
      }, { onConflict: "lock_name" });
    if (error) throw error;
    return true;
  }

  async releaseRunLock(runId: string) {
    const { error } = await this.client
      .from("deal_scrape_locks")
      .delete()
      .eq("lock_name", "dealtracker")
      .eq("run_id", runId);
    if (error) throw error;
  }

  async markRunRunning(runId: string) {
    const { error } = await this.client
      .from("deal_scrape_runs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", runId);
    if (error) throw error;
  }

  async finishRun(runId: string, status: "completed" | "partial" | "failed", exitCode: number, exitReason: string, totals: ScrapeRunTotals) {
    const { error } = await this.client
      .from("deal_scrape_runs")
      .update({
        status,
        finished_at: new Date().toISOString(),
        retailers_total: totals.retailersTotal,
        retailers_succeeded: totals.retailersSucceeded,
        retailers_failed: totals.retailersFailed,
        offers_seen: totals.offersSeen,
        observations_inserted: totals.observationsInserted,
        exit_code: exitCode,
        exit_reason: exitReason,
      })
      .eq("id", runId);
    if (error) throw error;
  }

  async listActiveRetailers(retailerFilter?: string) {
    let query = this.client
      .from("deal_retailers")
      .select("id,name,domain,active,adapter_key,config,request_delay_ms,request_timeout_ms,max_concurrency")
      .eq("active", true)
      .order("name", { ascending: true });

    if (retailerFilter) {
      query = query.or(`adapter_key.eq.${retailerFilter},domain.eq.${retailerFilter}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as RetailerRow[]).map(asRuntimeRetailer);
  }

  async startRetailerRun(runId: string, retailer: RuntimeRetailer) {
    const { error } = await this.client
      .from("deal_scrape_run_retailers")
      .upsert({
        run_id: runId,
        retailer_id: retailer.id,
        adapter_key: retailer.adapterKey,
        status: "running",
        started_at: new Date().toISOString(),
      }, { onConflict: "run_id,adapter_key" });
    if (error) throw error;
  }

  async finishRetailerRun(
    runId: string,
    retailer: RuntimeRetailer,
    status: "completed" | "partial" | "failed" | "skipped",
    summary: ScrapeRunSummary,
    writeResult: RetailerWriteResult,
  ) {
    const { error } = await this.client
      .from("deal_scrape_run_retailers")
      .upsert({
        run_id: runId,
        retailer_id: retailer.id,
        adapter_key: retailer.adapterKey,
        status,
        finished_at: new Date().toISOString(),
        duration_ms: summary.durationMs,
        products_seen: summary.productsSeen,
        products_normalized: summary.productsNormalized,
        variants_normalized: summary.variantsNormalized,
        offers_normalized: writeResult.offersSeen,
        duplicate_offers_skipped: summary.duplicateOffersSkipped,
        observations_inserted: writeResult.observationsInserted,
        product_errors: summary.productErrors,
        fatal_errors: summary.fatalErrors,
        dry_run: summary.dryRun,
      }, { onConflict: "run_id,adapter_key" });
    if (error) throw error;
  }

  async recordErrors(runId: string, retailer: RuntimeRetailer | null, errors: AdapterError[]) {
    if (!errors.length) return;
    const rows = errors.map((error) => ({
      run_id: runId,
      retailer_id: retailer?.id ?? null,
      adapter_key: error.retailerKey,
      error_code: error.code,
      message: error.message,
      details: {
        stage: error.stage,
        sourceId: error.sourceId ?? null,
        detailUrl: error.detailUrl ?? null,
        retryable: error.retryable,
      },
    }));
    const { error } = await this.client.from("deal_scrape_run_errors").insert(rows);
    if (error) throw error;
  }

  async writeRetailerProducts(
    runId: string,
    retailer: RuntimeRetailer,
    products: NormalizedFilamentProduct[],
    options: Pick<ScrapeRunOptions, "dryRun" | "validateOnly">,
  ): Promise<RetailerWriteResult> {
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
      active: true,
    }));

    const { data: savedProducts, error: productError } = await this.client
      .from("deal_products")
      .upsert(productRows, { onConflict: "retailer_id,source_id" })
      .select("id,source_id");
    if (productError) throw productError;

    const productIds = new Map(((savedProducts ?? []) as Array<IdRow & { source_id: string }>).map((row) => [row.source_id, row.id]));
    const variantRows = products.flatMap((product) => product.variants.map((variant) => ({
      product_id: productIds.get(product.sourceId),
      variant_key: variant.variantKey,
      variant_source_id: variant.variantSourceId ?? null,
      sku: variant.sku ?? null,
      color: variant.color,
      spool_weight_grams: variant.spoolWeightGrams,
      spool_count: variant.spoolCount,
      active: true,
    }))).filter((row) => row.product_id);

    const { data: savedVariants, error: variantError } = await this.client
      .from("deal_product_variants")
      .upsert(variantRows, { onConflict: "product_id,variant_key" })
      .select("id,product_id,variant_key");
    if (variantError) throw variantError;

    const variantIds = new Map(
      ((savedVariants ?? []) as Array<IdRow & { product_id: string; variant_key: string }>)
        .map((row) => [`${row.product_id}:${row.variant_key}`, row.id]),
    );

    const offerRows = products.flatMap((product) => product.variants.map((variant) => {
      const productId = productIds.get(product.sourceId);
      const variantId = productId ? variantIds.get(`${productId}:${variant.variantKey}`) : undefined;
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
        source_hash: variant.offer.sourceHash,
      } : null;
    })).filter((row): row is NonNullable<typeof row> => row !== null);

    const { data: savedOffers, error: offerError } = await this.client
      .from("deal_offers")
      .upsert(offerRows, { onConflict: "variant_id" })
      .select("id,variant_id");
    if (offerError) throw offerError;

    const offerIds = new Map(((savedOffers ?? []) as Array<IdRow & { variant_id: string }>).map((row) => [row.variant_id, row.id]));
    const observationRows = products.flatMap((product) => product.variants.map((variant) => {
      const productId = productIds.get(product.sourceId);
      const variantId = productId ? variantIds.get(`${productId}:${variant.variantKey}`) : undefined;
      const offerId = variantId ? offerIds.get(variantId) : undefined;
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
        observation_hash: variant.offer.sourceHash,
      } : null;
    })).filter((row): row is NonNullable<typeof row> => row !== null);

    const uniqueObservationRows = [...new Map(
      observationRows.map((row) => [`${row.offer_id}:${row.observation_hash}`, row]),
    ).values()];
    const { error: observationError } = await this.client
      .from("deal_price_observations")
      .upsert(uniqueObservationRows, { onConflict: "scrape_run_id,offer_id,observation_hash" });
    if (observationError) throw observationError;

    await this.markMissingVariantsInactive(retailer, variantRows.map((row) => String(row.variant_key)));
    await this.client
      .from("deal_retailers")
      .update({ last_successful_check_at: new Date().toISOString() })
      .eq("id", retailer.id);

    return { offersSeen, observationsInserted: uniqueObservationRows.length };
  }

  private async markMissingVariantsInactive(retailer: RuntimeRetailer, seenVariantKeys: string[]) {
    const { data: productRows, error: productError } = await this.client
      .from("deal_products")
      .select("id")
      .eq("retailer_id", retailer.id);
    if (productError) throw productError;
    const productIds = ((productRows ?? []) as IdRow[]).map((row) => row.id);
    if (!productIds.length) return;

    const { data: variantRows, error: readError } = await this.client
      .from("deal_product_variants")
      .select("id,variant_key")
      .in("product_id", productIds);
    if (readError) throw readError;

    const seen = new Set(seenVariantKeys);
    const missingIds = ((variantRows ?? []) as Array<IdRow & { variant_key: string }>)
      .filter((row) => !seen.has(row.variant_key))
      .map((row) => row.id);
    if (!missingIds.length) return;

    const { error } = await this.client
      .from("deal_product_variants")
      .update({ active: false })
      .in("id", missingIds);
    if (error) throw error;
  }
}
