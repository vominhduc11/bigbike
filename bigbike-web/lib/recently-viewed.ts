"use client";

const KEY = "bb_recently_viewed";
const MAX = 8;

export type RecentProduct = {
  id: string;
  slug: string;
  name: string;
  price?: number | null;
  imageUrl?: string | null;
  categoryName?: string | null;
};

export function saveRecentProduct(product: RecentProduct): void {
  if (typeof window === "undefined") return;
  try {
    const prev = getRecentProducts().filter((p) => p.id !== product.id);
    const next = [product, ...prev].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export function getRecentProducts(): RecentProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentProduct[];
  } catch {
    return [];
  }
}
