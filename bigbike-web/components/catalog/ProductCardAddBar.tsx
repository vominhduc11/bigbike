"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { toProductPath } from "@/lib/utils/routes";

type Props = {
  productId: string;
  hasVariants: boolean;
  slug: string;
};

export function ProductCardAddBar({ productId, hasVariants, slug }: Props) {
  const { addToCart, showToast } = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (hasVariants) {
      router.push(toProductPath(slug));
      return;
    }

    setBusy(true);
    addToCart(productId, 1)
      .catch(() => {
        showToast("Không thể thêm vào giỏ", "Vui lòng thử lại hoặc xem chi tiết sản phẩm.");
      })
      .finally(() => setBusy(false));
  }

  return (
    <button
      type="button"
      className="wp-product-addbar"
      disabled={busy}
      onClick={handleClick}
    >
      {hasVariants ? "CHỌN BIẾN THỂ" : busy ? "ĐANG THÊM..." : "THÊM VÀO GIỎ HÀNG"}
    </button>
  );
}
