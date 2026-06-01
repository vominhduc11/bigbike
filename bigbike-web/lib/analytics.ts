import type { CartItem } from "@/lib/contracts/commerce";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export function pushDataLayer(event: string, payload?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...payload });
}

export type GtmProductItem = {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  price?: number;
  currency?: string;
  quantity?: number;
};

/**
 * Map cart line items to the GTM/GA4 `items` payload shape. Shared by the cart
 * (`/gio-hang`) and checkout (`/thanh-toan`) pages, where this mapping was
 * duplicated verbatim. (The order-confirmation page builds a deliberately
 * different shape from `OrderLineItem[]` and is intentionally not routed here.)
 */
export function toGtmCartItems(items: CartItem[]): GtmProductItem[] {
  return items.map((item) => ({
    item_id: item.productId ?? item.sku ?? item.id,
    item_name: item.productName,
    price: item.unitPrice,
    quantity: item.quantity,
    currency: "VND",
  }));
}
