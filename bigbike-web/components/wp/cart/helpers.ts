import type { Cart } from "@/lib/contracts/commerce";

export function cartToDrafts(cart: Cart): Record<string, number> {
  return Object.fromEntries(cart.items.map((item) => [item.id, item.quantity]));
}
