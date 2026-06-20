export type PopularCategory = { name: string; slug: string };

export type SearchSuggestion = {
  id: string;
  slug: string;
  name: string;
  price?: { retailPrice?: number; salePrice?: number } | null;
  image?: { url?: string } | null;
};

export type ArticleSuggestion = {
  id: string;
  slug: string;
  title: string;
  category?: { name: string } | null;
  coverImage?: { url?: string } | null;
};
