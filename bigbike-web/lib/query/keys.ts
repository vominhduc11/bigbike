export const queryKeys = {
  cart: () => ["cart"] as const,
  checkoutOptions: (lang?: string) => ["checkout", "options", lang ?? "vi"] as const,
  publicSettings: () => ["settings", "public"] as const,
  profile: () => ["customer", "me"] as const,
  addresses: () => ["customer", "addresses"] as const,
  orders: (page: number) => ["customer", "orders", page] as const,
  order: (id: string) => ["customer", "order", id] as const,
  wishlistProducts: (page: number) => ["customer", "wishlist", "products", page] as const,
  productDetail: (slug: string) => ["product", "detail", slug] as const,
} as const;
