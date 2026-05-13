"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-col gap-3 mt-4">
      <Button
        type="button"
        variant="primary"
        className="w-full justify-center"
        onClick={handleAddToCart}
        disabled={loading}
      >
        {loading ? "Đang thêm..." : "Thêm vào giỏ hàng"}
      </Button>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
