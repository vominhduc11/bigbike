import type { WpCategoryFilterState } from "@/components/wp/WpCategorySidebar";
import {
  DEFAULT_PRODUCT_PAGE_SIZE as DEFAULT_PAGE_SIZE,
  DEFAULT_PRODUCT_SORT as DEFAULT_SORT,
  PRICE_PARAM_MAX,
  PRODUCT_SORT_VALUES,
} from "@/lib/constants/catalog";
import {
  DEFAULT_WP_ORDERBY,
  isWpOrderbyValue,
  productSortToWpOrderby,
  wpOrderbyToProductSort,
  type WpOrderbyValue,
} from "@/lib/utils/catalog-sort";
import {
  buildQueryString,
  collectErrors,
  parseOptionalPositiveIntParam,
  parsePositiveIntParam,
  parseSlugParam,
  parseSortParam,
  parseTextParam,
  readSearchParamAlias,
  readSingleSearchParam,
  type RouteSearchParams,
} from "@/lib/utils/query";

const ORDERBY_INVALID_MESSAGE = "orderby không hợp lệ.";

export type CatalogListParseOptions = {
  /**
   * Trang /san-pham và /tim-kiem cho phép lọc theo `category` qua query param;
   * trang danh mục/thương hiệu lấy category từ route nên không đọc param này.
   */
  includeCategoryParam?: boolean;
  /**
   * Khoá đọc từ khoá tìm kiếm. Mặc định `["q"]`; trang /tim-kiem dùng `["s", "q"]`.
   */
  queryParamKeys?: string[];
};

export type CatalogListFilters = {
  q: string | undefined;
  category: string | undefined;
  brand: string | undefined;
  color: string | undefined;
  gender: string | undefined;
  minPrice: number | undefined;
  maxPrice: number | undefined;
};

export type CatalogListParams = {
  page: number;
  size: number;
  productSort: string;
  orderbyCurrent: WpOrderbyValue;
  validationErrors: string[];
  /** Giá trị đã parse, dùng cho lời gọi listProducts / getCatalogFacets. */
  filters: CatalogListFilters;
  /** Shape `current` cho WpCategorySidebar (category undefined nếu trang không lọc category). */
  currentFilters: WpCategoryFilterState;
  /** Dựng href phân trang giữ nguyên filter hiện tại, theo path canonical của trang. */
  buildPaginationHref: (canonicalPath: string) => string;
};

/**
 * Parse + validate searchParams dùng chung cho 4 trang archive sản phẩm
 * (/san-pham, /tim-kiem, /danh-muc-san-pham/[slug], /brands/[slug]). Gom khối
 * parse page/size/brand/color/giá/sort vốn copy gần như y hệt ở cả 4 trang.
 */
export function parseCatalogListParams(
  params: RouteSearchParams,
  options: CatalogListParseOptions = {},
): CatalogListParams {
  const includeCategory = options.includeCategoryParam ?? false;
  const queryParamKeys = options.queryParamKeys ?? ["q"];

  const pageParsed = parsePositiveIntParam(readSearchParamAlias(params, "page", "paged"), {
    defaultValue: 1,
    min: 1,
    max: 999,
    field: "page",
  });
  const sizeParsed = parsePositiveIntParam(params.size, {
    defaultValue: DEFAULT_PAGE_SIZE,
    min: 1,
    max: 100,
    field: "size",
  });
  const qParsed = parseTextParam(readSearchParamAlias(params, ...queryParamKeys), 100);
  const categoryParsed = parseSlugParam(params.category, "category");
  const brandParsed = parseSlugParam(readSearchParamAlias(params, "pwb-brand", "brand"), "pwb-brand");
  const colorParsed = parseSlugParam(params.filter_color, "filter_color");
  const genderParsed = parseTextParam(params.filter_gender, 20);
  const minPriceParsed = parseOptionalPositiveIntParam(params.min_price, {
    min: 0,
    max: PRICE_PARAM_MAX,
    field: "min_price",
  });
  const maxPriceParsed = parseOptionalPositiveIntParam(params.max_price, {
    min: 0,
    max: PRICE_PARAM_MAX,
    field: "max_price",
  });
  const orderbyParam = readSingleSearchParam(params.orderby);
  const orderbyError = orderbyParam && !isWpOrderbyValue(orderbyParam) ? ORDERBY_INVALID_MESSAGE : null;
  const sortParsed = parseSortParam(params.sort, PRODUCT_SORT_VALUES, DEFAULT_SORT);
  const orderbyCurrent = isWpOrderbyValue(orderbyParam)
    ? orderbyParam
    : productSortToWpOrderby(sortParsed.value ?? DEFAULT_SORT);
  const productSort = isWpOrderbyValue(orderbyParam)
    ? wpOrderbyToProductSort(orderbyParam, DEFAULT_SORT)
    : sortParsed.value;

  const category = includeCategory ? categoryParsed.value : undefined;

  const validationErrors = collectErrors(
    qParsed.error,
    pageParsed.error,
    sizeParsed.error,
    includeCategory ? categoryParsed.error : null,
    brandParsed.error,
    colorParsed.error,
    genderParsed.error,
    minPriceParsed.error,
    maxPriceParsed.error,
    orderbyError,
    orderbyParam ? null : sortParsed.error,
  );

  const filters: CatalogListFilters = {
    q: qParsed.value,
    category,
    brand: brandParsed.value,
    color: colorParsed.value,
    gender: genderParsed.value,
    minPrice: minPriceParsed.value,
    maxPrice: maxPriceParsed.value,
  };

  const currentFilters: WpCategoryFilterState = {
    q: filters.q,
    category: filters.category,
    brand: filters.brand,
    color: filters.color,
    gender: filters.gender,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
  };

  const buildPaginationHref = (canonicalPath: string) =>
    `${canonicalPath}${buildQueryString({
      size: sizeParsed.value !== DEFAULT_PAGE_SIZE ? sizeParsed.value : undefined,
      orderby: orderbyCurrent !== DEFAULT_WP_ORDERBY ? orderbyCurrent : undefined,
      ...(includeCategory ? { category: filters.category } : {}),
      "pwb-brand": filters.brand,
      q: filters.q,
      filter_color: filters.color,
      filter_gender: filters.gender,
      min_price: filters.minPrice,
      max_price: filters.maxPrice,
    })}`;

  return {
    page: pageParsed.value,
    size: sizeParsed.value,
    productSort,
    orderbyCurrent,
    validationErrors,
    filters,
    currentFilters,
    buildPaginationHref,
  };
}
