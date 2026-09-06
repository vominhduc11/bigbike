"use client";

import Link from "@/i18n/StorefrontLink";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { trackAddToCart } from "@/lib/analytics";
import { addCartItem } from "@/lib/api/client-api";
import { useCartQuery } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { useAuth } from "@/lib/auth/auth-store";
import { toCartPath } from "@/lib/utils/routes";
import type { Cart } from "@/lib/contracts/commerce";
import type { Locale } from "@/i18n/locale";

type Toast = {
  id: number;
  title: string;
  message: string;
};

type CartContextValue = {
  cartCount: number | null;
  addToCart: (
    productId: string,
    quantity: number,
    variantId?: string,
    suppressToast?: boolean,
  ) => Promise<Cart>;
  showToast: (title: string, message: string) => void;
  refreshCount: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const t = useTranslations("Cart");
  const locale = useLocale() as Locale;
  const qc = useQueryClient();
  // Single shared cache for the whole app (queryKeys.cart()) — the same query
  // CartClient, MobileCartSheet and useCheckout now all read/write. Sửa/xoá
  // ở bất kỳ đâu (mutation gọi qc.setQueryData(queryKeys.cart(), ...)) tự động
  // cập nhật số ở đây, không cần refreshCount() riêng của từng nơi nữa.
  const cartQuery = useCartQuery();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const cartCount = cartQuery.data
    ? cartQuery.data.items.reduce((sum, item) => sum + item.quantity, 0)
    : null;

  const refreshCount = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.cart() });
  }, [qc]);

  // Re-sync cart when auth changes (e.g. after login, backend merges guest cart).
  // Initial load is handled by useCartQuery() itself — no separate mount-time fetch needed.
  useEffect(() => {
    if (auth.status === "loading") return;
    refreshCount();
  }, [auth.status, refreshCount]);

  const showToast = useCallback((title: string, message: string) => {
    const id = ++nextId.current;
    setToasts((prev) => [...prev, { id, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const addToCart = useCallback(
    async (
      productId: string,
      quantity: number,
      variantId?: string,
      suppressToast = false,
    ) => {
      const previous = qc.getQueryData<Cart>(queryKeys.cart());
      const updated = await addCartItem(productId, quantity, variantId);
      qc.setQueryData(queryKeys.cart(), updated);
      // Single choke point for `add_to_cart`: `addCartItem` throws on failure, so reaching this
      // line means the backend accepted the item. Covers the PDP button, the mobile sticky bar
      // (which clicks that same button) and the assistant's product card.
      //
      // The line is found by diffing the cart, not by matching the id we sent: the server owns
      // line identity and may clamp the quantity to available stock, so the diff reports what
      // was really added rather than what was asked for. The id match is only a fallback.
      const previousQuantities = new Map(
        (previous?.items ?? []).map((line) => [line.id, line.quantity]),
      );
      const grown = updated.items
        .map((line) => ({ line, delta: line.quantity - (previousQuantities.get(line.id) ?? 0) }))
        .filter((entry) => entry.delta > 0)
        .sort((a, b) => b.delta - a.delta)[0];
      const addedLine =
        grown?.line ?? updated.items.find((line) => line.productId === productId);
      if (addedLine) trackAddToCart(addedLine, grown?.delta ?? quantity);
      if (!suppressToast) showToast(t("toastAddedTitle"), t("toastAddedBody"));
      return updated;
    },
    [qc, showToast, t],
  );

  return (
    <CartContext.Provider value={{ cartCount, addToCart, showToast, refreshCount }}>
      {children}
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="bb-cart-toast"
          role="status"
          aria-live="polite"
        >
          <div>
            <b className="mb-0.5 block font-body text-a5-meta font-bold text-brand">{toast.title}</b>
            <span className="text-a5-meta text-muted-foreground">{toast.message}</span>
          </div>
          <Link href={toCartPath(locale)} className="text-a5-meta font-bold text-brand no-underline whitespace-nowrap tracking-wide shrink-0 hover:text-brand-hover">
            {t("toastViewCart")}
          </Link>
        </div>
      ))}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
