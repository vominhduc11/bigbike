export const queryKeys = {
  cart: () => ["cart"] as const,
  profile: () => ["customer", "me"] as const,
  addresses: () => ["customer", "addresses"] as const,
  orders: (page: number, status?: string) => ["customer", "orders", page, status ?? "all"] as const,
  order: (id: string) => ["customer", "order", id] as const,
  productDetail: (slug: string) => ["product", "detail", slug] as const,
  /**
   * fetchPublicSettings(locale) — shared by EN-locale-swap client consumers
   * (for example HomeLocalizedSettings, OrderConfirmClient) so React Query dedupes
   * them into one request per locale instead of one per component with its own
   * ad-hoc key.
   *
   * MUST stay a distinct key from publicSettingsResult() below (queryFn
   * `listPublicSettings`, shape `{data,error}`). fetchPublicSettings resolves to a
   * plain array — sharing the cache key made OrderConfirmClient inherit the
   * `{data,error}` object from Checkout's cache entry (identical checkout →
   * order-confirm nav order) and crash on `.map`.
   */
  publicSettings: (locale: string) => ["public-settings-list", locale] as const,
  /**
   * listPublicSettings(locale) — shape `{data, error}`. Shared by CheckoutClient
   * and ProductView (both need the live settings result + error state, not just
   * the array) so they dedupe into one request per locale instead of each
   * hand-typing the same literal key.
   */
  publicSettingsResult: (locale: string) => ["public-settings", locale] as const,
  /**
   * Live price/stock/variants snapshot for a product — shared by ProductTrustLive
   * (mobile trust line) and PurchaseSection (buy box) so both read the SAME
   * real-time source instead of drifting (see PurchaseSection.tsx comment).
   */
  productSnapshot: (slug: string, locale: string) => ["product-snapshot", slug, locale] as const,
} as const;
