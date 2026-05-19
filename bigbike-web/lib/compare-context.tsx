"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  COMPARE_MAX,
  getCompareProducts,
  saveCompareProducts,
  type CompareProduct,
} from "@/lib/compare-storage";

/**
 * Result of a `toggle` call. `ok: false` carries the reason the product
 * could not be added so the caller can surface the right toast message.
 */
export type CompareToggleResult =
  | { ok: true }
  | { ok: false; reason: "full" | "category" };

type CompareContextValue = {
  items: CompareProduct[];
  /** False until the localStorage list has been read on the client. */
  hydrated: boolean;
  isComparing: (productId: string) => boolean;
  toggle: (product: CompareProduct) => CompareToggleResult;
  remove: (productId: string) => void;
  clear: () => void;
  max: number;
};

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  // Start empty so server and first client render match; hydrate from
  // localStorage right after mount.
  const [items, setItems] = useState<CompareProduct[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // Mirror of `items` read synchronously inside `toggle` — avoids stale
  // closures and the non-synchronous setState updater pitfall.
  const itemsRef = useRef<CompareProduct[]>([]);

  useEffect(() => {
    const stored = getCompareProducts();
    itemsRef.current = stored;
    // Defer the state commit out of the synchronous effect body — mirrors the
    // `RecentlyViewedSection` localStorage-hydration pattern.
    const id = setTimeout(() => {
      setItems(stored);
      setHydrated(true);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const commit = useCallback((next: CompareProduct[]) => {
    itemsRef.current = next;
    setItems(next);
    saveCompareProducts(next);
  }, []);

  const toggle = useCallback(
    (product: CompareProduct): CompareToggleResult => {
      const current = itemsRef.current;
      if (current.some((p) => p.id === product.id)) {
        commit(current.filter((p) => p.id !== product.id));
        return { ok: true };
      }
      if (current.length >= COMPARE_MAX) {
        return { ok: false, reason: "full" };
      }
      if (current.length > 0 && current[0].categoryId !== product.categoryId) {
        return { ok: false, reason: "category" };
      }
      commit([...current, product]);
      return { ok: true };
    },
    [commit],
  );

  const remove = useCallback(
    (productId: string) => {
      commit(itemsRef.current.filter((p) => p.id !== productId));
    },
    [commit],
  );

  const clear = useCallback(() => commit([]), [commit]);

  const isComparing = useCallback(
    (productId: string) => items.some((p) => p.id === productId),
    [items],
  );

  const value = useMemo<CompareContextValue>(
    () => ({ items, hydrated, isComparing, toggle, remove, clear, max: COMPARE_MAX }),
    [items, hydrated, isComparing, toggle, remove, clear],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used within CompareProvider");
  return ctx;
}
