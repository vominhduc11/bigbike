"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { addCartItem } from "@/lib/api/client-api";
import { useCartQuery } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { useAuth } from "@/lib/auth/auth-store";
import { toCartPath } from "@/lib/utils/routes";

type Toast = {
  id: number;
  title: string;
  message: string;
};

type CartContextValue = {
  cartCount: number | null;
  addToCart: (productId: string, quantity: number, variantId?: string) => Promise<void>;
  showToast: (title: string, message: string) => void;
  refreshCount: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const t = useTranslations("Cart");
  const qc = useQueryClient();
  // Single shared cache for the whole app (queryKeys.cart()) — the same query
  // WpCartClient, MobileCartSheet and useCheckout now all read/write. Sửa/xoá
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
    async (productId: string, quantity: number, variantId?: string) => {
      const updated = await addCartItem(productId, quantity, variantId);
      qc.setQueryData(queryKeys.cart(), updated);
      showToast(t("toastAddedTitle"), t("toastAddedBody"));
    },
    [qc, showToast, t],
  );

  return (
    <CartContext.Provider value={{ cartCount, addToCart, showToast, refreshCount }}>
      {children}
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="bb-cart-toast fixed top-[88px] right-5 z-[600] bg-white border border-brand border-l-[3px] py-[14px] px-[18px] shadow-[var(--bb-shadow-lg)] flex gap-3 items-center max-w-[360px] animate-[bb-toast-in_0.3s_ease] [@media(max-width:480px)]:top-[calc(var(--bb-header-stack)+8px)] [@media(max-width:480px)]:right-3 [@media(max-width:480px)]:left-3 [@media(max-width:480px)]:max-w-none"
          role="status"
          aria-live="polite"
        >
          <div>
            <b className="block text-caption font-bold tracking-display uppercase text-brand mb-[2px]">{toast.title}</b>
            <span className="text-caption text-muted-foreground">{toast.message}</span>
          </div>
          <Link href={toCartPath()} className="text-caption font-bold text-brand no-underline whitespace-nowrap tracking-wide shrink-0 hover:text-brand-hover">
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
