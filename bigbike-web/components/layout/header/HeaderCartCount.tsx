"use client";

import { useCart } from "@/lib/cart-context";

export function HeaderCartCount() {
  const { cartCount } = useCart();
  const count = cartCount ?? 0;
  if (count <= 0) return null;

  return (
    <span className="bb-cart-badge absolute right-[7px] top-[18px] grid min-h-4 min-w-4 place-items-center rounded-full bg-brand-on-dark px-1 text-ui-12 font-bold leading-4 text-white">
      {count}
    </span>
  );
}
