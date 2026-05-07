"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { addCartItem, fetchCart } from "@/lib/api/client-api";
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
      showToast("ĐÃ THÊM VÀO GIỎ", "Tiếp tục mua hoặc vào giỏ để thanh toán.");
    },
    [refreshCount, showToast],
  );

  return (
    <CartContext.Provider value={{ cartCount, addToCart, showToast, refreshCount }}>
      {children}
      {toasts.map((toast) => (
        <div key={toast.id} className="wp-toast" role="status" aria-live="polite">
          <div>
            <b>{toast.title}</b>
            <span>{toast.message}</span>
          </div>
          <a href={toCartPath()} className="wp-toast-cta">Xem giỏ →</a>
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
