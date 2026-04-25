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
