export const queryKeys = {
  cart: () => ["cart"] as const,
  checkoutOptions: () => ["checkout", "options"] as const,
  publicSettings: () => ["settings", "public"] as const,
  profile: () => ["customer", "me"] as const,
  addresses: () => ["customer", "addresses"] as const,
  orders: (page: number) => ["customer", "orders", page] as const,
  order: (id: string) => ["customer", "order", id] as const,
} as const;
