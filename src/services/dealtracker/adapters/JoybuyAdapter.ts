import type { JsonValue } from "../../../types/Dealtracker.ts";
import {
  centsToEuro,
  euroToCents,
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

type JoybuyAdapterOptions = {
  feedUrl?: string;
  feedText?: string;
};

type FeedRow = Record<string, string>;

const JOYBUY_DOMAIN = "www.joybuy.nl";
const MATERIAL_PATTERN = /\bPLA\s*(?:\+|PLUS|BASIC|BIO|SILK|MATTE|MATT|META|HS|HIGH SPEED)?\b/i;
const PLA_PLUS_PATTERN = /\bPLA\s*\+|\bPLA\s*(?:PLUS|BIO)\b/i;

function parseDelimited(value: string): FeedRow[] {
  const delimiter = value.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
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
  return rows
    .filter((cells) => cells.some((item) => item.trim()))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""])));
}

function field(row: FeedRow, names: string[]) {
  for (const name of names) {
    const value = row[name.toLowerCase()];
    if (value) return value.trim();
  }
  return "";
}

function parseMoneyCents(value: string): number | null {
  const normalized = value
    .replace(/\bEUR\b/gi, "")
    .replace(/[€\s]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .trim();
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return euroToCents(parsed);
}

function parseWeightGrams(text: string): number | null {
  const multipack = text.match(/\b(\d{1,2})\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|kilogram|g|gram)\b/i);
  if (multipack) {
    const count = Number.parseInt(multipack[1]!, 10);
    const weight = Number.parseFloat(multipack[2]!.replace(",", "."));
    if (Number.isFinite(count) && Number.isFinite(weight) && count > 0 && weight > 0) {
      const grams = /kg|kilogram/i.test(multipack[3]!) ? weight * 1000 : weight;
      return Math.round(count * grams);
    }
  }

  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilogram|g|gram)\b/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1]!.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  return /kg|kilogram/i.test(match[2]!) ? Math.round(value * 1000) : Math.round(value);
}

function parseSpoolCount(text: string): number {
  const explicit = text.match(/\b(\d{1,2})\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:kg|g|gram)\b/i)
    ?? text.match(/\bset\s*(?:van)?\s*(\d{1,2})\b/i)
    ?? text.match(/\b(\d{1,2})\s*(?:rollen|spoelen|spools)\b/i);
  return explicit ? Math.max(1, Number.parseInt(explicit[1]!, 10)) : 1;
}

function parseDiameterMm(text: string): number | undefined {
  const match = text.match(/(\d(?:[.,]\d{1,2})?)\s*mm\b/i);
  if (!match) return undefined;
  const value = Number.parseFloat(match[1]!.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function parseColor(text: string) {
  const known = text.match(/\b(zwart|wit|blauw|groen|rood|geel|oranje|brons|goud|zilver|grijs|textuurgrijs|transparant|cyaan|rainbow|regenboog|multicolor|paars|roze|bruin)\b/i)?.[1];
  if (known) return known.trim();
  const afterSlash = text.match(/\/\s*([^/|,-]+)\s*(?:$|[|,-])/i)?.[1];
  const afterDash = text.match(/-\s*([^-/|]+)$/)?.[1];
  return (afterSlash || afterDash || "Onbekend").trim();
}

function parseStock(value: string) {
  const normalized = value.toLowerCase();
  if (/out|uitverkocht|niet op voorraad/.test(normalized)) return "uitverkocht";
  if (/preorder|voorverkoop/.test(normalized)) return "preorder";
  if (/backorder|nabesteld/.test(normalized)) return "backorder";
  if (/in stock|op voorraad|beschikbaar|vandaag|morgen/.test(normalized)) return "op voorraad";
  return "unknown";
}

function stableId(row: FeedRow) {
  return field(row, ["id", "g:id", "aw_product_id", "product_id", "item_group_id", "sku"])
    || field(row, ["link", "deeplink", "product_url"])
      .replace(/^https?:\/\//i, "")
      .replace(/[?#].*$/, "");
}

function stableHash(value: Record<string, JsonValue>) {
  const serialized = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function shippingFromRow(row: FeedRow) {
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

function rowText(row: FeedRow) {
  return [
    field(row, ["title", "product_name", "name"]),
    field(row, ["description"]),
    field(row, ["product_type", "google_product_category", "category"]),
  ].join(" ");
}

function isJoybuyNlUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === JOYBUY_DOMAIN || url.hostname === "joybuy.nl";
  } catch {
    return false;
  }
}

function isPlaProduct(row: FeedRow) {
  return MATERIAL_PATTERN.test(rowText(row));
}

export class JoybuyAdapter implements RetailerAdapter {
  private readonly feedUrl?: string;
  private readonly feedText?: string;

  constructor(options: JoybuyAdapterOptions = {}) {
    this.feedUrl = options.feedUrl;
    this.feedText = options.feedText;
  }

  identify() {
    return {
      key: "joybuy-nl",
      name: "Joybuy",
      domain: JOYBUY_DOMAIN,
      countryCode: "NL",
      adapterType: "affiliate_feed" as const,
    };
  }

  async fetchProductOverview(context: AdapterContext) {
    if (this.feedText !== undefined) return this.feedText;
    if (!this.feedUrl) throw new Error("Joybuy feedUrl ontbreekt.");
    return context.http.fetchText(this.feedUrl, {
      timeoutMs: 15_000,
      acceptedContentTypes: ["text/csv", "text/plain", "text/tab-separated-values", "application/octet-stream"],
      maxResponseBytes: 5_000_000,
    });
  }

  async parseProductOverview(source: JsonValue | string): Promise<RawRetailerProduct[]> {
    if (typeof source !== "string") throw new Error("Joybuy feed moet tekst zijn.");
    return parseDelimited(source)
      .filter((row) => isPlaProduct(row))
      .map((row) => ({
        sourceId: stableId(row),
        detailUrl: field(row, ["link", "deeplink", "product_url"]),
        payload: row,
      }))
      .filter((product) => product.sourceId && product.detailUrl);
  }

  async normalizeProduct(product: RawRetailerProduct, context: AdapterContext): Promise<NormalizedFilamentProduct> {
    const row = product.payload as FeedRow;
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
      material,
    });

    if (!validation.accepted || !validation.pricing) {
      throw new Error(`Aanbieding afgewezen: ${validation.errors.join(", ")}`);
    }

    const color = parseColor(text);
    const variantKey = [
      field(row, ["item_group_id", "g:item_group_id"]),
      field(row, ["sku", "mpn", "g:mpn"]),
      color,
      validation.pricing.totalWeightGrams,
    ].filter(Boolean).join("|").toLowerCase();

    const offer: NormalizedOffer = {
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
        stock: validation.pricing.stockStatus,
      }),
    };

    const variant: NormalizedVariant = {
      variantKey,
      variantSourceId: field(row, ["id", "g:id", "aw_product_id", "product_id"]),
      sku: field(row, ["sku", "mpn", "g:mpn"]) || undefined,
      color,
      spoolWeightGrams: spoolWeightGrams ?? 0,
      spoolCount,
      totalWeightGrams: resolveTotalWeightGrams({ totalWeightGrams: validation.pricing.totalWeightGrams }),
      offer,
    };

    return {
      retailerKey: this.identify().key,
      sourceId: product.sourceId,
      productName: field(row, ["title", "product_name", "name"]),
      brand: field(row, ["brand", "manufacturer"]) || "Joybuy",
      material,
      productUrl: url,
      imageUrl: field(row, ["image_link", "image_url", "aw_image_url"]) || undefined,
      diameterMm: parseDiameterMm(text),
      active: true,
      variants: [variant],
    };
  }
}

export const joybuyInternalsForTests = {
  parseDelimited,
  parseWeightGrams,
  parseSpoolCount,
  parseMoneyCents,
  shippingFromRow,
};
