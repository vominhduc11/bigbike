export const WP_ORDERBY_VALUES = [
  "menu_order",
  "popularity",
  "date",
  "price",
  "price-desc",
] as const;

export type WpOrderbyValue = (typeof WP_ORDERBY_VALUES)[number];

export const DEFAULT_WP_ORDERBY: WpOrderbyValue = "menu_order";

export function isWpOrderbyValue(value: string | null | undefined): value is WpOrderbyValue {
  return WP_ORDERBY_VALUES.includes(value as WpOrderbyValue);
}

export function wpOrderbyToProductSort(
  orderby: WpOrderbyValue | null | undefined,
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

export function productSortToWpOrderby(sort: string | null | undefined): WpOrderbyValue {
  switch (sort) {
    case "price:asc":
      return "price";
    case "price:desc":
      return "price-desc";
    case "createdAt:desc":
    default:
      return DEFAULT_WP_ORDERBY;
  }
}
