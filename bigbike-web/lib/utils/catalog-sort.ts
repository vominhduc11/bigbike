 const CATALOG_ORDERBY_VALUES = [
  "menu_order",
  "popularity",
  "date",
  "price",
  "price-desc",
] as const;

export type CatalogOrderbyValue = (typeof CATALOG_ORDERBY_VALUES)[number];

export const DEFAULT_CATALOG_ORDERBY: CatalogOrderbyValue = "menu_order";

export function isCatalogOrderbyValue(value: string | null | undefined): value is CatalogOrderbyValue {
  return CATALOG_ORDERBY_VALUES.includes(value as CatalogOrderbyValue);
}

export function wpOrderbyToProductSort(
  orderby: CatalogOrderbyValue | null | undefined,
  defaultSort: string,
): string {
  switch (orderby) {
    case "date":
      return "createdAt:desc";
    case "price":
      return "price:asc";
    case "price-desc":
      return "price:desc";
    case "menu_order":
    case "popularity":
    default:
      return defaultSort;
  }
}

export function productSortToOrderby(sort: string | null | undefined): CatalogOrderbyValue {
  switch (sort) {
    case "price:asc":
      return "price";
    case "price:desc":
      return "price-desc";
    case "createdAt:desc":
    default:
      return DEFAULT_CATALOG_ORDERBY;
  }
}
