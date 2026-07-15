export type PopularCategory = { name: string; slug: string };

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
