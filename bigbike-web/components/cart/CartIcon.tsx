"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { BBTooltip } from "@/components/ui/BBTooltip";
import { toCartPath } from "@/lib/utils/routes";

export function CartIcon() {
  const { cartCount } = useCart();

  return (
    <BBTooltip content="Giỏ hàng">
    <Link href={toCartPath()} className="bb-cart-icon-link" aria-label="Giỏ hàng">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {cartCount !== null && cartCount > 0 && (
        <span className="bb-cart-badge">{cartCount > 99 ? "99+" : cartCount}</span>
      )}
    </Link>
    </BBTooltip>
  );
}
