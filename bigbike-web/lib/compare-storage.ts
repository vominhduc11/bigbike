"use client";

/**
 * Client-only persistence for the product comparison list. Mirrors the
 * `recently-viewed.ts` pattern: a single localStorage key, capped length,
 * deduped by id, every read/write wrapped so storage errors never throw.
 */

const KEY = "bb_compare";
export const COMPARE_MAX = 3;

export type CompareProduct = {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string | null;
  /** Best display price (sale price when on sale, else retail). Null = "Liên hệ". */
  price?: number | null;
  /** Drives the same-category restriction — only products sharing this can be compared. */
  categoryId: string;
  categoryName: string;
};

export function getCompareProducts(): CompareProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CompareProduct[];
    return Array.isArray(parsed) ? parsed.slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

export function saveCompareProducts(list: CompareProduct[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, COMPARE_MAX)));
  } catch {
    // ignore storage errors (private mode, quota, …)
  }
}
