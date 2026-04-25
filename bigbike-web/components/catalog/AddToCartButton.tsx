"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addCartItem } from "@/lib/api/client-api";
import { toCartPath } from "@/lib/utils/routes";

type AddToCartButtonProps = {
  productId: string;
  variantId?: string | null;
};

export function AddToCartButton({ productId, variantId }: AddToCartButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAddToCart() {
    setLoading(true);
    setError("");
    try {
      await addCartItem(productId, 1, variantId ?? undefined);
      router.push(toCartPath());
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
        {loading ? "Đang thêm..." : "Thêm vào giỏ"}
      </button>
      {error ? (
        <p className="bb-status-banner" style={{ marginTop: "var(--bb-space-3)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
