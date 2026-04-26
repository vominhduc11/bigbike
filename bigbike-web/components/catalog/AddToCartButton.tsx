"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-context";

type AddToCartButtonProps = {
  productId: string;
  variantId?: string | null;
};

export function AddToCartButton({ productId, variantId }: AddToCartButtonProps) {
  const { addToCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAddToCart() {
    setLoading(true);
    setError("");
    try {
      await addToCart(productId, 1, variantId ?? undefined);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="bb-button bb-button-primary"
        style={{ width: "100%", justifyContent: "center", marginTop: "var(--bb-space-4)" }}
        onClick={handleAddToCart}
        disabled={loading}
      >
        {loading ? "Đang thêm..." : "THÊM VÀO GIỎ HÀNG"}
      </button>
      {error ? (
        <p className="bb-status-banner" style={{ marginTop: "var(--bb-space-3)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
