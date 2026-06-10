"use client";

import { useCart } from "@/lib/cart-context";

/** Số lượng giỏ hàng thật của bigbike-web, render trong markup WP (.number-cart). */
export function WpCartCount() {
  const { cartCount } = useCart();
  const count = cartCount ?? 0;
  if (count <= 0) return null;
  return <span className="number-cart">{count}</span>;
}
