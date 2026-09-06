import type { Cart, CartItem, OrderDetail, OrderLineItem } from "@/lib/contracts/commerce";
import type { Product } from "@/lib/contracts/public";
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

/**
 * `item_id` must be the real merchant SKU so Google Merchant Center and Google Ads can match the
 * product. The internal id is only a last resort for a line that genuinely has no SKU.
 */
export function toGa4ItemFromProduct(
  product: Product,
  options?: { index?: number; list?: Ga4List },
): Ga4Item {
  const { current } = derivePricing(product.price);
  return {
    item_id: product.sku ?? product.slug,
    item_name: product.name,
    item_brand: product.brand?.name,
    item_category: product.category?.name,
    item_list_id: options?.list?.id,
    item_list_name: options?.list?.name,
    index: options?.index,
    price: toVndAmount(current),
    currency: GA_CURRENCY,
    quantity: 1,
  };
}

/** Cart lines carry no brand/category, so those two fields stay empty by design. */
export function toGa4ItemFromCart(item: CartItem): Ga4Item {
  return {
    item_id: item.sku ?? item.productId ?? item.id,
    item_name: item.productName,
    price: toVndAmount(item.unitPrice),
    quantity: item.quantity,
    currency: GA_CURRENCY,
  };
}

export function toGa4ItemsFromCart(items: CartItem[]): Ga4Item[] {
  return items.map(toGa4ItemFromCart);
}

export function toGa4ItemsFromOrder(lineItems: OrderLineItem[]): Ga4Item[] {
  return lineItems.map((item) => ({
    item_id: item.sku ?? item.productId ?? item.id,
    item_name: item.productName,
    price: toVndAmount(item.unitPrice),
    quantity: item.quantity,
    currency: GA_CURRENCY,
  }));
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

export function trackViewItem(product: Product): void {
  const { current } = derivePricing(product.price);
  sendEvent("view_item", {
    currency: GA_CURRENCY,
    value: toVndAmount(current),
    items: [toGa4ItemFromProduct(product)],
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
