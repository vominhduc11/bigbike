"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { addToWishlist, fetchWishlist, removeFromWishlist } from "@/lib/api/client-api";
import { useAuth } from "@/lib/auth/auth-store";

type WishlistContextValue = {
  wishlist: Set<string>;
  toggle: (productId: string) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (auth.status !== "authenticated") {
      setWishlist(new Set());
      return;
    }
    fetchWishlist()
      .then((ids) => setWishlist(new Set(ids)))
      .catch(() => {});
  }, [auth.status]);

  const toggle = useCallback(async (productId: string) => {
    if (auth.status !== "authenticated") return;
    if (wishlist.has(productId)) {
      setWishlist((prev) => { const next = new Set(prev); next.delete(productId); return next; });
      await removeFromWishlist(productId).catch(() => {
        setWishlist((prev) => new Set([...prev, productId]));
      });
    } else {
      setWishlist((prev) => new Set([...prev, productId]));
      await addToWishlist(productId).catch(() => {
        setWishlist((prev) => { const next = new Set(prev); next.delete(productId); return next; });
      });
    }
  }, [wishlist]);

  const isWishlisted = useCallback((productId: string) => wishlist.has(productId), [wishlist]);

  return (
    <WishlistContext.Provider value={{ wishlist, toggle, isWishlisted }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
