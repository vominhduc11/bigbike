import type { ImageAsset, ProductPrice } from "@/lib/contracts/public";

export type SearchShortcut = {
  id: string;
  name: string;
  href: string;
  count?: number;
  image?: ImageAsset | null;
  price?: ProductPrice | null;
};

export type SearchShortcuts = {
  trendingBrands: SearchShortcut[];
  suggestedProducts: SearchShortcut[];
  popularCategories: SearchShortcut[];
};

export type SearchSuggestion = {
  id: string;
  slug: string;
  slugEn?: string | null;
  name: string;
  price?: { retailPrice?: number; salePrice?: number } | null;
  image?: { url?: string } | null;
};

export type ArticleSuggestion = {
  id: string;
  slug: string;
  slugEn?: string | null;
  title: string;
  category?: { name: string } | null;
  coverImage?: { url?: string } | null;
};
