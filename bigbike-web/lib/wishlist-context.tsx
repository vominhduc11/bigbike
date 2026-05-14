"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { addToWishlist, fetchWishlist, removeFromWishlist } from "@/lib/api/client-api";
import { useAuth } from "@/lib/auth/auth-store";

type WishlistContextValue = {
  wishlist: Set<string>;
  toggle: (productId: string) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);
const EMPTY_WISHLIST = new Set<string>();

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (auth.status !== "authenticated") {
      return undefined;
    }

    let active = true;
    fetchWishlist()
      .then((ids) => {
        if (active) setWishlist(new Set(ids));
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [auth.status]);

  const visibleWishlist = auth.status === "authenticated" ? wishlist : EMPTY_WISHLIST;

  const toggle = useCallback(async (productId: string) => {
    if (auth.status !== "authenticated") return;
    if (visibleWishlist.has(productId)) {
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
  }, [auth.status, visibleWishlist]);

  const isWishlisted = useCallback((productId: string) => visibleWishlist.has(productId), [visibleWishlist]);
  const value = useMemo(
    () => ({ wishlist: visibleWishlist, toggle, isWishlisted }),
    [isWishlisted, toggle, visibleWishlist],
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
