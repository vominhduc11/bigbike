export const queryKeys = {
  cart: () => ["cart"] as const,
  profile: () => ["customer", "me"] as const,
  addresses: () => ["customer", "addresses"] as const,
  orders: (page: number, status?: string) => ["customer", "orders", page, status ?? "all"] as const,
  order: (id: string) => ["customer", "order", id] as const,
  productDetail: (slug: string) => ["product", "detail", slug] as const,
  /**
   * fetchPublicSettings(locale) — shared by EN-locale-swap client consumers
   * (for example HomeLocalizedSettings) so React Query dedupes them into
   * one request per locale instead of one per component with its own ad-hoc key.
   *
   * MUST stay a distinct key from the literal ["public-settings", locale] used by
   * CheckoutClient/ProductView (queryFn `listPublicSettings`, shape `{data,error}`).
   * fetchPublicSettings resolves to a plain array — sharing the cache key made
   * OrderConfirmClient inherit the `{data,error}` object from Checkout's cache entry
   * (identical checkout → order-confirm nav order) and crash on `.map`.
   */
  publicSettings: (locale: string) => ["public-settings-list", locale] as const,
} as const;
