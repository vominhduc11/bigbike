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
   */
  publicSettings: (locale: string) => ["public-settings", locale] as const,
} as const;
