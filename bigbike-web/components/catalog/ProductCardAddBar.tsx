"use client";

import { useCart } from "@/lib/cart-context";

export function ProductCardAddBar({ productId }: { productId: string }) {
  const { addToCart } = useCart();

  return (
    <button
      type="button"
      className="wp-product-addbar"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        addToCart(productId, 1).catch(() => {});
      }}
    >
      THÊM VÀO GIỎ HÀNG
    </button>
  );
}
