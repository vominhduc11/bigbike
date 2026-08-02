"use client";

import { safeStorage } from "@/lib/utils/storage";

const KEY = "bb_recently_viewed";
const MAX = 8;

export type RecentProduct = {
  id: string;
  slug: string;
  name: string;
  price?: number | null;
  imageUrl?: string | null;
  categoryName?: string | null;
  /** Approved-review average — chỉ dùng khi ratingCount ≥ 1 (REVIEW_RULE_003). */
  rating?: number | null;
  /** Approved-review count; missing/zero values resolve to neutral stars on cards. */
  ratingCount?: number | null;
};

export function saveRecentProduct(product: RecentProduct): void {
  const prev = getRecentProducts().filter((p) => p.id !== product.id);
  const next = [product, ...prev].slice(0, MAX);
  safeStorage.set(KEY, next);
}

export function getRecentProducts(): RecentProduct[] {
  return safeStorage.get<RecentProduct[]>(KEY, []);
}
