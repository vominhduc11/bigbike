"use client";

/**
 * Client-only persistence for the product comparison list. Mirrors the
 * `recently-viewed.ts` pattern: a single localStorage key, capped length,
 * deduped by id, every read/write wrapped so storage errors never throw.
 */

import { safeStorage } from "@/lib/utils/storage";

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
  const parsed = safeStorage.get<CompareProduct[]>(KEY, []);
  return Array.isArray(parsed) ? parsed.slice(0, COMPARE_MAX) : [];
}

export function saveCompareProducts(list: CompareProduct[]): void {
  safeStorage.set(KEY, list.slice(0, COMPARE_MAX));
}
