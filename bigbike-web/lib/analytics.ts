import type { Cart, CartItem, OrderDetail, OrderLineItem } from "@/lib/contracts/commerce";
import type { Product, ProductVariant } from "@/lib/contracts/public";
import { derivePricing } from "@/lib/pricing";
import { env } from "@/env";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Storefront measurement — the single component-facing surface for GA4, Meta and Clarity.
 *
 * Every analytics call in `bigbike-web` goes through this module. Nothing else may touch
 * `window.gtag`, `window.dataLayer` or `window.fbq`: a second browser install would double-count
 * measurement, revenue included. `gtag.js` and the existing Meta Pixel are each loaded once in
 * `app/[locale]/layout.tsx`, only when their approved public ids are set.
 *
 * `page_view` / `PageView` are deliberately absent here — GA4 Enhanced Measurement and Meta's
 * own library record them, including client-side navigation. Firing either manually would
 * double-count. See `docs/engineering/INTEGRATION_GUIDE.md` §§"Google Analytics 4" / "Meta Pixel".
 */

/** VND everywhere. The storefront has no second currency. */
export const GA_CURRENCY = "VND";

/**
 * The storefront has no carrier chooser: shipping inside the system is always free and any real
 * fee is settled with the customer off-platform. A fixed tier records the delivery step without
 * inventing a carrier or payment choice.
 */
export const GA_SHIPPING_TIER = "Miễn phí";
export const GA_PAYMENT_TYPE = "COD";

const GA4_CLIENT_ID_PATTERN = /^\d+\.\d+$/;

const SESSION_EVENT_PREFIX = "bb_analytics:";
const PENDING_AUTH_EVENT_KEY = `${SESSION_EVENT_PREFIX}pending_auth`;
const claimedSessionEvents = new Set<string>();

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
  // Clarity custom events are labels only. Parameters stay in GA4 and are never copied into a
  // recording, which keeps contact/product metadata out of the replay payload.
  window.clarity?.("event", name);
}

type MetaStandardEvent =
  | "ViewContent"
  | "AddToCart"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Purchase"
  | "Search"
  | "Contact";

/**
 * Meta is an additional destination of the same storefront measurement surface, not a second
 * component-facing API. The root layout creates `fbq` only when the approved public id is set,
 * so this is also a safe no-op in local/staging and when a blocker prevents the loader running.
 */
function sendMetaEvent(
  name: MetaStandardEvent,
  params: Record<string, unknown>,
  eventId?: string,
): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  if (eventId) {
    window.fbq("track", name, params, { eventID: eventId });
    return;
  }
  window.fbq("track", name, params);
}

/**
 * Read GA4's own pseudonymous browser id for a later server-side cancellation correction.
 * Failure, blockers and blank local configuration resolve silently: measurement must never stop
 * checkout. The value contains no customer-entered data.
 */
export function getAnalyticsClientId(
  measurementId = env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
  timeoutMs = 800,
): Promise<string | undefined> {
  if (typeof window === "undefined" || !measurementId) {
    return Promise.resolve(undefined);
  }
  const gtag = window.gtag;
  if (!gtag) return Promise.resolve(undefined);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value?: unknown) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      const normalized = typeof value === "string" ? value.trim() : "";
      resolve(
        normalized.length <= 128 && GA4_CLIENT_ID_PATTERN.test(normalized) ? normalized : undefined,
      );
    };
    const timer = window.setTimeout(finish, Math.max(0, timeoutMs));
    try {
      gtag("get", measurementId, "client_id", finish);
    } catch {
      finish();
    }
  });
}

/**
 * Atomically claim an action for this browser session. Storage survives a reload while the
 * in-memory set also protects callers when sessionStorage is unavailable.
 */
export function claimAnalyticsSessionEvent(key: string): boolean {
  if (typeof window === "undefined") return false;
  const storageKey = `${SESSION_EVENT_PREFIX}${key}`;
  if (claimedSessionEvents.has(storageKey)) return false;
  try {
    if (window.sessionStorage.getItem(storageKey) === "1") {
      claimedSessionEvents.add(storageKey);
      return false;
    }
    window.sessionStorage.setItem(storageKey, "1");
  } catch {
    // Privacy modes can disable storage. The in-memory latch still prevents remount duplicates.
  }
  claimedSessionEvents.add(storageKey);
  return true;
}

type ProductAnalyticsContext = {
  product_id?: string;
  product_name?: string;
  item_brand?: string;
  item_category?: string;
};

function currentProductContext(): ProductAnalyticsContext {
  if (typeof document === "undefined") return {};
  const root = document.querySelector<HTMLElement>("[data-analytics-product-id]");
  if (!root) return {};
  return {
    product_id: root.dataset.analyticsProductId?.trim() || undefined,
    product_name: root.dataset.analyticsProductName?.trim() || undefined,
    item_brand: root.dataset.analyticsProductBrand?.trim() || undefined,
    item_category: root.dataset.analyticsProductCategory?.trim() || undefined,
  };
}

function withProductContext(params: Record<string, unknown>): Record<string, unknown> {
  return { ...params, ...currentProductContext() };
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

/** Shared commerce shape keeps Meta content ids byte-for-byte aligned with GA4 and GMC SKU ids. */
function metaCommercePayload(items: Ga4Item[], value: number): Record<string, unknown> {
  const contents = items.map((item) => ({
    id: item.item_id,
    quantity: Math.max(1, Math.trunc(item.quantity ?? 1)),
    item_price: toVndAmount(item.price),
  }));
  return {
    content_ids: items.map((item) => item.item_id),
    contents,
    content_type: "product",
    currency: GA_CURRENCY,
    value: toVndAmount(value),
    num_items: contents.reduce((total, item) => total + item.quantity, 0),
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
  const value = toVndAmount(item.price);
  sendEvent("view_item", {
    currency: GA_CURRENCY,
    value,
    items: [item],
  });
  sendMetaEvent("ViewContent", {
    ...metaCommercePayload([item], value),
    content_name: item.item_name,
    ...(item.item_category ? { content_category: item.item_category } : {}),
  });
}

/** Fired only after the backend confirms the line — a failed add must not be counted. */
export function trackAddToCart(item: CartItem, quantity: number): void {
  const analyticsItem = { ...toGa4ItemFromCart(item), quantity };
  const value = toVndAmount(item.unitPrice * quantity);
  sendEvent("add_to_cart", {
    currency: GA_CURRENCY,
    value,
    items: [analyticsItem],
  });
  sendMetaEvent("AddToCart", metaCommercePayload([analyticsItem], value));
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
  const items = toGa4ItemsFromCart(cart.items);
  const value = toVndAmount(cart.totals.totalAmount);
  sendEvent("begin_checkout", {
    currency: cart.currency ?? GA_CURRENCY,
    value,
    items,
  });
  sendMetaEvent("InitiateCheckout", metaCommercePayload(items, value));
}

export function trackAddShippingInfo(cart: Cart): void {
  sendEvent("add_shipping_info", {
    currency: cart.currency ?? GA_CURRENCY,
    value: toVndAmount(cart.totals.totalAmount),
    shipping_tier: GA_SHIPPING_TIER,
    items: toGa4ItemsFromCart(cart.items),
  });
}

/** COD is the only new-order payment method. This records confirmation, not a method choice UI. */
export function trackAddPaymentInfo(cart: Cart): void {
  const items = toGa4ItemsFromCart(cart.items);
  const value = toVndAmount(cart.totals.totalAmount);
  sendEvent("add_payment_info", {
    currency: cart.currency ?? GA_CURRENCY,
    value,
    payment_type: GA_PAYMENT_TYPE,
    items,
  });
  sendMetaEvent("AddPaymentInfo", metaCommercePayload(items, value));
}

/**
 * `transaction_id` is the real, unique order number — never a timestamp or random value, or GA4
 * would treat a reload as a second sale. Call sites must keep their own once-per-order guard.
 */
export function trackPurchase(order: OrderDetail): void {
  const items = toGa4ItemsFromOrder(order.lineItems);
  const value = toVndAmount(order.totalAmount);
  sendEvent("purchase", {
    transaction_id: order.orderNumber,
    currency: order.currency ?? GA_CURRENCY,
    value,
    shipping: toVndAmount(order.shippingAmount),
    tax: toVndAmount(order.taxAmount),
    items,
  });
  sendMetaEvent("Purchase", metaCommercePayload(items, value), `purchase_${order.orderNumber}`);
}

export type ContactChannel = "phone" | "zalo" | "messenger";

export function trackContactClick(channel: ContactChannel, placement: string): void {
  sendEvent("contact_click", withProductContext({ contact_channel: channel, placement }));
  sendMetaEvent("Contact", { content_name: channel });
}

export type ProductContentSection =
  "description" | "specifications" | "video" | "reviews" | "commitments";

export function trackScrollDepth(percent: number, pagePath: string): void {
  sendEvent("scroll_depth", { percent_scrolled: percent, page_path: pagePath });
}

export function trackContentSection(section: ProductContentSection, pagePath: string): void {
  sendEvent(
    "view_content_section",
    withProductContext({ section_name: section, page_path: pagePath }),
  );
}

export type CatalogFilterType = "brand" | "size" | "price";

export function trackCatalogFilter(
  filterType: CatalogFilterType,
  filterValue: string,
  resultCount: number,
): void {
  sendEvent("catalog_filter", {
    filter_type: filterType,
    filter_value: filterValue || "none",
    result_count: Math.max(0, Math.trunc(resultCount)),
  });
}

export type SearchSurface = "header_quick" | "results_page";

const REDACTED_SEARCH_TERM = "[redacted]";
const EMAIL_IN_SEARCH = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const VI_PHONE_IN_SEARCH = /(?:^|\D)(?:\+?84|0)(?:[\s().-]*\d){8,10}(?:\D|$)/;
const OPAQUE_SECRET_IN_SEARCH =
  /\b(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[A-Za-z0-9_-]{24,})\b/i;

/**
 * Search is free text, so it must be minimized before it reaches GA4. Product words/SKUs remain
 * useful; obvious contact details and opaque tokens are replaced as a whole, never partially.
 */
function analyticsSearchTerm(value: string): string {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (!normalized) return "";
  if (
    EMAIL_IN_SEARCH.test(normalized) ||
    VI_PHONE_IN_SEARCH.test(normalized) ||
    OPAQUE_SECRET_IN_SEARCH.test(normalized)
  ) {
    return REDACTED_SEARCH_TERM;
  }
  return Array.from(normalized).slice(0, 100).join("");
}

export function trackSearch(term: string, resultCount: number, surface: SearchSurface): void {
  const searchTerm = analyticsSearchTerm(term);
  if (!searchTerm) return;
  sendEvent("search", {
    search_term: searchTerm,
    result_count: Math.max(0, Math.trunc(resultCount)),
    search_surface: surface,
  });
  sendMetaEvent("Search", { search_string: searchTerm });
}

export function trackSelectPromotion(input: { id: string; name: string; placement: string }): void {
  sendEvent("select_promotion", {
    promotion_id: input.id,
    promotion_name: input.name,
    creative_slot: input.placement,
  });
}

export function trackSizeGuideUse(resultSize: string): void {
  sendEvent("size_guide_use", withProductContext({ result_size: resultSize }));
}

export function trackReviewSubmit(input: {
  productId: string;
  rating: number;
  photoCount: number;
}): void {
  sendEvent("review_submit", {
    product_id: input.productId,
    rating: Math.max(1, Math.min(5, Math.trunc(input.rating))),
    photo_count: Math.max(0, Math.trunc(input.photoCount)),
  });
}

export function trackVideoOpen(input: {
  id: string;
  title?: string | null;
  provider?: string | null;
  placement: string;
}): void {
  sendEvent(
    "video_open",
    withProductContext({
      video_id: input.id,
      video_title: input.title?.trim() || undefined,
      video_provider: input.provider?.trim() || undefined,
      placement: input.placement,
    }),
  );
}

export type AuthenticationEvent = "login" | "sign_up";

export function trackAuthentication(event: AuthenticationEvent, method: string): void {
  sendEvent(event, { method });
}

type PendingAuthenticationEvent = {
  event: AuthenticationEvent;
  method: string;
  createdAt: number;
};

export function markPendingAuthentication(event: AuthenticationEvent, method: string): void {
  if (typeof window === "undefined") return;
  const pending: PendingAuthenticationEvent = { event, method, createdAt: Date.now() };
  try {
    window.sessionStorage.setItem(PENDING_AUTH_EVENT_KEY, JSON.stringify(pending));
  } catch {
    // The redirect can still proceed; analytics must never block authentication.
  }
}

export function clearPendingAuthentication(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_AUTH_EVENT_KEY);
  } catch {
    // Best effort only.
  }
}

export function consumePendingAuthentication(): PendingAuthenticationEvent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_AUTH_EVENT_KEY);
    window.sessionStorage.removeItem(PENDING_AUTH_EVENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingAuthenticationEvent>;
    if (
      (parsed.event !== "login" && parsed.event !== "sign_up") ||
      typeof parsed.method !== "string" ||
      typeof parsed.createdAt !== "number" ||
      Date.now() - parsed.createdAt > 15 * 60 * 1000
    ) {
      return null;
    }
    return parsed as PendingAuthenticationEvent;
  } catch {
    return null;
  }
}

/** Internal customer id only. Never pass a profile object or a friendly name. */
export function setAnalyticsUserId(userId?: string): void {
  if (typeof window === "undefined") return;
  window.gtag?.("set", { user_id: userId || null });
  if (userId) window.clarity?.("identify", userId);
}
