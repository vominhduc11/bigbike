import type { ProductPrice } from "@/lib/contracts/public";

export type DerivedPricing = {
  /** Base retail price (0 when no price data). */
  retail: number;
  /** Active sale price when set and > 0, otherwise null. */
  sale: number | null;
  /** Compare-at ("was") price when set and > 0, otherwise null. */
  compare: number | null;
  /** Effective price shown to the customer (sale when present, else retail). */
  current: number;
  /** Whether to surface a sale treatment (sale below retail, or compare above current). */
  isSale: boolean;
  /** Rounded discount percentage, or null when there is no discount. */
  discountPercent: number | null;
};

/**
 * Derive the canonical sale/compare/current/discount view of a product price.
 *
 * Single source of truth for product-card and comparison pricing — extracted
 * verbatim from the original `ProductCard.computePricing` so rendered output is
 * unchanged. Callers that only want the "was" price when it beats the current
 * price must gate `compare` with `compare > current` themselves (this function
 * exposes the raw >0-guarded compare-at value, matching the card's behaviour).
 */
export function derivePricing(price: ProductPrice | null | undefined): DerivedPricing {
  const retail = price?.retailPrice ?? 0;
  const sale = price?.salePrice && price.salePrice > 0 ? price.salePrice : null;
  const compare =
    price?.compareAtPrice && price.compareAtPrice > 0 ? price.compareAtPrice : null;
  const current = sale ?? retail;
  const isSale = Boolean((sale && sale < retail) || (compare && compare > current));
  const reference = compare ?? retail;
  const discountPercent =
    sale && reference > sale
      ? Math.round(((reference - sale) / reference) * 100)
      : compare && compare > current
        ? Math.round(((compare - current) / compare) * 100)
        : null;
  return { retail, sale, compare, current, isSale, discountPercent };
}
