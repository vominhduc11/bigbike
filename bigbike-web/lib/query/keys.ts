export const queryKeys = {
  cart: () => ["cart"] as const,
  checkoutOptions: (lang?: string) => ["checkout", "options", lang ?? "vi"] as const,
  profile: () => ["customer", "me"] as const,
  addresses: () => ["customer", "addresses"] as const,
  orders: (page: number, status?: string) => ["customer", "orders", page, status ?? "all"] as const,
  order: (id: string) => ["customer", "order", id] as const,
  productDetail: (slug: string) => ["product", "detail", slug] as const,
} as const;
