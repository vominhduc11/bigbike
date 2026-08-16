import type { CatalogFacets } from "@/lib/contracts/public";

export type CatalogFilterState = {
  q?: string;
  category?: string;
  brand: string[];
  color: string[];
  finish: string[];
  gender?: string;
  size: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock: boolean;
};

export type CatalogFilterGroupKey =
  | "brand"
  | "price"
  | "size"
  | "color"
  | "finish"
  | "stock"
  | "gender";

export type CatalogFilterToken =
  | { group: "brand" | "color" | "finish" | "size"; value: string }
  | { group: "gender" | "price" | "stock"; value?: string };

export function countCatalogFilters(state: CatalogFilterState): number {
  return state.brand.length
    + state.color.length
    + state.finish.length
    + state.size.length
    + (state.gender ? 1 : 0)
    + (state.minPrice != null || state.maxPrice != null ? 1 : 0)
    + (state.inStock ? 1 : 0);
}

export function removeCatalogFilter(
  state: CatalogFilterState,
  token: CatalogFilterToken,
): CatalogFilterState {
  if (token.group === "brand" || token.group === "color" || token.group === "finish" || token.group === "size") {
    return { ...state, [token.group]: state[token.group].filter((value) => value !== token.value) };
  }
  if (token.group === "gender") return { ...state, gender: undefined };
  if (token.group === "price") return { ...state, minPrice: undefined, maxPrice: undefined };
  return { ...state, inStock: false };
}

export function clearCatalogFilters(state: CatalogFilterState): CatalogFilterState {
  return {
    ...state,
    brand: [],
    color: [],
    finish: [],
    gender: undefined,
    size: [],
    minPrice: undefined,
    maxPrice: undefined,
    inStock: false,
  };
}

export function toggleCatalogArrayValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function getAvailableCatalogFilterGroups(
  facets: CatalogFacets | null | undefined,
  hideBrandFilter = false,
): CatalogFilterGroupKey[] {
  const groups: CatalogFilterGroupKey[] = [];
  if (!hideBrandFilter && facets?.brands?.length) groups.push("brand");
  if (facets?.priceRange) groups.push("price");
  if (facets?.sizeGroups?.some((group) => group.buckets.length)) groups.push("size");
  if (facets?.colors?.length) groups.push("color");
  if (facets?.finishes?.length) groups.push("finish");
  if (facets?.availability) groups.push("stock");
  if (facets?.genders?.length) groups.push("gender");
  return groups;
}
