import type { Brand, CatalogFacets, Category } from "@/lib/contracts/public";

export type WpCategoryFilterState = {
  q?: string;
  category?: string;
  brand?: string;
  color?: string;
  gender?: string;
  minPrice?: number;
  maxPrice?: number;
};

export type WpCategorySidebarProps = {
  brands: Brand[];
  categories: Category[];
  facets?: CatalogFacets | null;
  current: WpCategoryFilterState;
  resetHref: string;
  hiddenParams?: Record<string, string | undefined>;
};
