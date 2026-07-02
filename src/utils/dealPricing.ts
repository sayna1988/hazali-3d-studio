import type { DealMaterial, DealStockStatus } from "../types/Dealtracker";

export type DealOfferCandidate = {
  productPrice: number;
  normalPrice?: number | null;
  directDiscount?: number;
  shippingCost?: number;
  spoolWeightGrams?: number | null;
  spoolCount?: number | null;
  totalWeightGrams?: number | null;
  stockStatus?: string | null;
  material?: string | null;
};

export type DealPricing = {
  productPriceCents: number;
  normalPriceCents: number | null;
  directDiscountCents: number;
  shippingCostCents: number;
  totalPriceCents: number;
  pricePerKgCents: number;
  totalWeightGrams: number;
  stockStatus: DealStockStatus;
  material: DealMaterial;
};

export type DealOfferValidation = {
  accepted: boolean;
  errors: string[];
  pricing?: DealPricing;
};

const STOCK_ALIASES: Record<string, DealStockStatus> = {
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
  vooruitbestellen: "preorder",
};

export function gramsToKilograms(grams: number): number {
  if (!Number.isFinite(grams) || grams <= 0) return 0;
  return grams / 1000;
}

export function totalMultipackWeightGrams(spoolWeightGrams: number, spoolCount: number): number {
  if (!Number.isFinite(spoolWeightGrams) || !Number.isFinite(spoolCount)) return 0;
  if (spoolWeightGrams <= 0 || spoolCount <= 0) return 0;
  return Math.round(spoolWeightGrams) * Math.round(spoolCount);
}

export function euroToCents(amount: number): number {
  if (!Number.isFinite(amount)) return Number.NaN;
  return Math.round((amount + Number.EPSILON) * 100);
}

export function centsToEuro(cents: number): number {
  if (!Number.isFinite(cents)) return Number.NaN;
  return Math.round(cents) / 100;
}

export function roundEuroAmount(amount: number): number {
  return centsToEuro(euroToCents(amount));
}

export function calculateTotalPriceCents(
  productPriceCents: number,
  shippingCostCents = 0,
  directDiscountCents = 0,
): number {
  return productPriceCents + shippingCostCents - directDiscountCents;
}

export function calculatePricePerKgCents(totalPriceCents: number, totalWeightGrams: number): number {
  if (!Number.isFinite(totalPriceCents) || !Number.isFinite(totalWeightGrams) || totalWeightGrams <= 0) {
    return Number.NaN;
  }
  return Math.round((totalPriceCents * 1000) / totalWeightGrams);
}

export function normalizeStockStatus(value: string | null | undefined): DealStockStatus {
  if (!value) return "unknown";
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return STOCK_ALIASES[normalized] ?? STOCK_ALIASES[normalized.replace(/\s/g, "")] ?? "unknown";
}

export function normalizeMaterialName(value: string | null | undefined): DealMaterial {
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

export function resolveTotalWeightGrams(candidate: Pick<DealOfferCandidate, "spoolWeightGrams" | "spoolCount" | "totalWeightGrams">): number {
  if (candidate.totalWeightGrams !== undefined && candidate.totalWeightGrams !== null) {
    return Number.isFinite(candidate.totalWeightGrams) && candidate.totalWeightGrams > 0
      ? Math.round(candidate.totalWeightGrams)
      : 0;
  }

  return totalMultipackWeightGrams(candidate.spoolWeightGrams ?? 0, candidate.spoolCount ?? 1);
}

export function validateDealOffer(candidate: DealOfferCandidate): DealOfferValidation {
  const errors: string[] = [];
  const productPriceCents = euroToCents(candidate.productPrice);
  const normalPriceCents = candidate.normalPrice === undefined || candidate.normalPrice === null
    ? null
    : euroToCents(candidate.normalPrice);
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
      material,
    },
  };
}
