"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { addCartItem, fetchCart } from "@/lib/api/client-api";
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
  const [cartCount, setCartCount] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const fetchInFlight = useRef(false);

  const refreshCount = useCallback(() => {
    if (fetchInFlight.current) return;
    fetchInFlight.current = true;
    fetchCart()
      .then((cart) => {
        const total = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        setCartCount(total);
      })
      .catch(() => {})
      .finally(() => { fetchInFlight.current = false; });
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // Re-sync cart count when auth changes (e.g. after login, backend merges guest cart)
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
      await addCartItem(productId, quantity, variantId);
      refreshCount();
      showToast("ÄĂƒ THĂM VĂ€O GIá»", "Tiáº¿p tá»¥c mua hoáº·c vĂ o giá» Ä‘á»ƒ thanh toĂ¡n.");
    },
    [refreshCount, showToast],
  );

  return (
    <CartContext.Provider value={{ cartCount, addToCart, showToast, refreshCount }}>
      {children}
      {toasts.map((toast) => (
        <div key={toast.id} className="fixed top-[88px] right-5 z-[600] bg-white border border-brand border-l-[3px] py-[14px] px-[18px] shadow-[var(--bb-shadow-lg)] flex gap-3 items-center max-w-[360px] animate-[bb-toast-in_0.3s_ease] [@media(max-width:480px)]:top-[calc(var(--bb-header-stack)+8px)] [@media(max-width:480px)]:right-3 [@media(max-width:480px)]:left-3 [@media(max-width:480px)]:max-w-none" role="status" aria-live="polite">
          <div>
            <b className="block text-sm font-bold tracking-[0.08em] uppercase text-brand mb-[2px]">{toast.title}</b>
            <span className="text-sm text-muted-foreground">{toast.message}</span>
          </div>
          <Link href={toCartPath()} className="text-sm font-bold text-brand no-underline whitespace-nowrap tracking-[0.04em] shrink-0 hover:text-brand-hover">Xem giá» â†’</Link>
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

