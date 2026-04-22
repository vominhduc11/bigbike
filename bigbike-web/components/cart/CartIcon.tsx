"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchCart } from "@/lib/api/client-api";
import { toCartPath } from "@/lib/utils/routes";

export function CartIcon() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetchCart()
      .then((cart) => {
        const total = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        setCount(total);
      })
      .catch(() => setCount(null));
  }, []);

  return (
    <Link href={toCartPath()} className="bb-cart-icon-link" aria-label="Gio hang">
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
      {count !== null && count > 0 && (
        <span className="bb-cart-badge">{count > 99 ? "99+" : count}</span>
      )}
    </Link>
  );
}
