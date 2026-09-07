import type { Cart, CartItem, OrderDetail, OrderLineItem } from "@/lib/contracts/commerce";
import type { Product, ProductVariant } from "@/lib/contracts/public";
import { derivePricing } from "@/lib/pricing";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Google Analytics 4 — the single measurement surface of the storefront.
 *
 * Every analytics call in `bigbike-web` goes through this module. Nothing else may touch
 * `window.gtag` or `window.dataLayer`: a second install would double-count every number the
 * property reports, revenue included. `gtag.js` itself is loaded once, in
 * `app/[locale]/layout.tsx`, and only when `NEXT_PUBLIC_GA4_MEASUREMENT_ID` is set.
 *
 * `page_view` is deliberately absent here — GA4's own Enhanced Measurement records it, including
 * client-side navigation. Firing it by hand would double-count unless the shop owner also turned
 * that GA4 setting off. See `docs/engineering/INTEGRATION_GUIDE.md` §"Google Analytics 4".
 */

/** VND everywhere. The storefront has no second currency. */
export const GA_CURRENCY = "VND";

/**
 * The storefront has no carrier chooser: shipping inside the system is always free and any real
 * fee is settled with the customer off-platform. A fixed tier keeps GA4's ordered checkout funnel
 * complete instead of leaving a hole between `begin_checkout` and `add_payment_info`.
 */
export const GA_SHIPPING_TIER = "Miễn phí";

export type Ga4Item = {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  item_list_id?: string;
  item_list_name?: string;
  index?: number;
  price?: number;
  currency?: string;
  quantity?: number;
};

/** A product list surface, used for `view_item_list` / `select_item` attribution. */
export type Ga4List = { id: string; name: string };

/**
 * VND has no minor unit: GA4 must receive plain integers, never formatted strings and never
 * cent-scaled values. Backend money is `BigDecimal`, so `1500000.00` can reach us as a float.
 */
function toVndAmount(value: number | null | undefined): number {
  return Number.isFinite(value) ? Math.round(value as number) : 0;
}

function sendEvent(name: string, params: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  // Absent when the measurement id is not configured — analytics stays silent, nothing throws.
  window.gtag?.("event", name, params);
}

/** Catalog cards have no selected size. Use one deterministic selling variant, not the parent SKU. */
export function getAnalyticsVariant(product: Product): ProductVariant | undefined {
  const variants = product.variants ?? [];
  const available = variants.filter((variant) => variant.isAvailable);
  const { current } = derivePricing(product.price);
  return (
    available.find(
      (variant) => derivePricing(variant.price ?? product.price).current === current,
    ) ??
    variants.find((variant) => derivePricing(variant.price ?? product.price).current === current) ??
    available[0] ??
    variants[0]
  );
}

type ItemInput = {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  variant?: string | null;
  price: number;
  quantity: number;
  index?: number;
  list?: Ga4List;
};

/** Single payload builder for all ten events; never spread cart/order/customer objects into GA4. */
function toGa4Item(input: ItemInput): Ga4Item {
  return {
    item_id: input.id,
    item_name: input.name,
    item_brand: input.brand?.trim() || undefined,
    item_category: input.category?.trim() || undefined,
    item_variant: input.variant?.trim() || undefined,
    item_list_id: input.list?.id,
    item_list_name: input.list?.name,
    index: input.index,
    price: toVndAmount(input.price),
    currency: GA_CURRENCY,
    quantity: input.quantity,
  };
}

/** GMC_RULE_003: variant SKU for a variant, product SKU only for a simple product. */
export function toGa4ItemFromProduct(
  product: Product,
  options?: { index?: number; list?: Ga4List; variant?: ProductVariant },
): Ga4Item {
  const variant = options?.variant ?? getAnalyticsVariant(product);
  const { current } = derivePricing(variant?.price ?? product.price);
  return toGa4Item({
    id: variant ? variant.sku?.trim() || variant.id : product.sku?.trim() || product.slug,
    name: product.name,
    brand: product.brand?.name,
    category: product.category?.name,
    variant: variant?.name,
    list: options?.list,
    index: options?.index,
    price: current,
    quantity: 1,
  });
}

/** Both commerce responses retain the selling SKU and the purchased variant description. */
export function toGa4ItemFromCart(item: CartItem | OrderLineItem): Ga4Item {
  return toGa4Item({
    id: item.sku?.trim() || item.productId || item.id,
    name: item.productName,
    brand: item.brandName,
    category: item.categoryName,
    variant: item.variantName,
    price: item.unitPrice,
    quantity: item.quantity,
  });
}

export function toGa4ItemsFromCart(items: CartItem[]): Ga4Item[] {
  return items.map(toGa4ItemFromCart);
}

export function toGa4ItemsFromOrder(lineItems: OrderLineItem[]): Ga4Item[] {
  return lineItems.map(toGa4ItemFromCart);
}

export function trackViewItemList(products: Product[], list: Ga4List): void {
  if (products.length === 0) return;
  sendEvent("view_item_list", {
    item_list_id: list.id,
    item_list_name: list.name,
    items: products.map((product, index) => toGa4ItemFromProduct(product, { index, list })),
  });
}

export function trackSelectItem(product: Product, list: Ga4List, index?: number): void {
  sendEvent("select_item", {
    item_list_id: list.id,
    item_list_name: list.name,
    items: [toGa4ItemFromProduct(product, { index, list })],
  });
}

export function trackViewItem(product: Product, variant?: ProductVariant): void {
  const item = toGa4ItemFromProduct(product, { variant });
  sendEvent("view_item", {
    currency: GA_CURRENCY,
    value: item.price,
    items: [item],
  });
}

/** Fired only after the backend confirms the line — a failed add must not be counted. */
export function trackAddToCart(item: CartItem, quantity: number): void {
  sendEvent("add_to_cart", {
    currency: GA_CURRENCY,
    value: toVndAmount(item.unitPrice * quantity),
    items: [{ ...toGa4ItemFromCart(item), quantity }],
  });
}

export function trackRemoveFromCart(item: CartItem): void {
  sendEvent("remove_from_cart", {
    currency: GA_CURRENCY,
    value: toVndAmount(item.unitPrice * item.quantity),
    items: [toGa4ItemFromCart(item)],
  });
}

export function trackViewCart(cart: Cart): void {
  sendEvent("view_cart", {
    currency: cart.currency ?? GA_CURRENCY,
    value: toVndAmount(cart.totals.totalAmount),
    items: toGa4ItemsFromCart(cart.items),
  });
}

export function trackBeginCheckout(cart: Cart): void {
  sendEvent("begin_checkout", {
    currency: cart.currency ?? GA_CURRENCY,
    value: toVndAmount(cart.totals.totalAmount),
    items: toGa4ItemsFromCart(cart.items),
  });
}

export function trackAddShippingInfo(cart: Cart): void {
  sendEvent("add_shipping_info", {
    currency: cart.currency ?? GA_CURRENCY,
    value: toVndAmount(cart.totals.totalAmount),
    shipping_tier: GA_SHIPPING_TIER,
    items: toGa4ItemsFromCart(cart.items),
  });
}

export function trackAddPaymentInfo(cart: Cart, paymentType: string): void {
  sendEvent("add_payment_info", {
    currency: cart.currency ?? GA_CURRENCY,
    value: toVndAmount(cart.totals.totalAmount),
    payment_type: paymentType,
    items: toGa4ItemsFromCart(cart.items),
  });
}

/**
 * `transaction_id` is the real, unique order number — never a timestamp or random value, or GA4
 * would treat a reload as a second sale. Call sites must keep their own once-per-order guard.
 */
export function trackPurchase(order: OrderDetail): void {
  sendEvent("purchase", {
    transaction_id: order.orderNumber,
    currency: order.currency ?? GA_CURRENCY,
    value: toVndAmount(order.totalAmount),
    shipping: toVndAmount(order.shippingAmount),
    tax: toVndAmount(order.taxAmount),
    items: toGa4ItemsFromOrder(order.lineItems),
  });
}
