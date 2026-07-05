import type { ProductPrice } from "@/lib/contracts/public";

export type DerivedPricing = {
  /** Base retail price (0 when no price data). */
  retail: number;
  /** Active sale price when set and > 0 and lower than retail, otherwise null. */
  sale: number | null;
  /** Effective price shown to the customer (sale when present, else retail). */
  current: number;
  /** Whether to surface a sale treatment (struck-through retail + discount badge). */
  isSale: boolean;
  /** Rounded discount percentage, or null when there is no discount. */
  discountPercent: number | null;
};

/**
 * Derive the canonical sale/current/discount view of a product price.
 *
 * Single source of truth for PDP and product-card pricing. Two-field model:
 * retail is always the list price; when a valid sale price is set (> 0 and
 * lower than retail), retail is shown struck through and sale is the price
 * charged. No sale price → plain retail, no strikethrough, no badge.
 */
export function derivePricing(price: ProductPrice | null | undefined): DerivedPricing {
  const retail = price?.retailPrice ?? 0;
  const rawSale = price?.salePrice && price.salePrice > 0 ? price.salePrice : null;
  const isSale = Boolean(rawSale && rawSale < retail);
  const sale = isSale ? rawSale : null;
  const current = sale ?? retail;
  const discountPercent = isSale ? Math.round(((retail - sale!) / retail) * 100) : null;
  return { retail, sale, current, isSale, discountPercent };
}
