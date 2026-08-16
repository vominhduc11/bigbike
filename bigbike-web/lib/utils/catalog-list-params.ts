import type { CatalogFilterState } from "@/lib/utils/catalog-filter-state";
import {
  DEFAULT_PRODUCT_PAGE_SIZE as DEFAULT_PAGE_SIZE,
  DEFAULT_PRODUCT_SORT as DEFAULT_SORT,
  PRICE_PARAM_MAX,
  PRODUCT_SORT_VALUES,
} from "@/lib/constants/catalog";
import {
  DEFAULT_CATALOG_ORDERBY,
  isCatalogOrderbyValue,
  productSortToOrderby,
  wpOrderbyToProductSort,
  type CatalogOrderbyValue,
} from "@/lib/utils/catalog-sort";
import {
  buildQueryString,
  collectErrors,
  parsePositiveIntParam,
  parseSlugParam,
  parseSortParam,
  parseTextParam,
  readSearchParamValues,
  readSearchParamAlias,
  readSingleSearchParam,
  type RouteSearchParams,
} from "@/lib/utils/query";

const ORDERBY_INVALID_MESSAGE = "orderby không hợp lệ.";

 type CatalogListParseOptions = {
  /**
   * Trang /sp và /tim-kiem cho phép lọc theo `category` qua query param;
   * trang danh mục/thương hiệu lấy category từ route nên không đọc param này.
   */
  includeCategoryParam?: boolean;
  /**
   * Khoá đọc từ khoá tìm kiếm. Mặc định `["q"]`; trang /tim-kiem dùng `["s", "q"]`.
   */
  queryParamKeys?: string[];
};

 type CatalogListFilters = {
  q: string | undefined;
  category: string | undefined;
  brand: string[];
  color: string[];
  finish: string[];
  gender: string | undefined;
  size: string[];
  minPrice: number | undefined;
  maxPrice: number | undefined;
  inStock: boolean;
};

type CatalogListParams = {
  page: number;
  size: number;
  productSort: string;
  orderbyCurrent: CatalogOrderbyValue;
  validationErrors: string[];
  /** Giá trị đã parse, dùng cho lời gọi listProducts / getCatalogFacets. */
  filters: CatalogListFilters;
  /** Shape `current` cho CatalogSidebar (category undefined nếu trang không lọc category). */
  currentFilters: CatalogFilterState;
  /** Dựng href phân trang giữ nguyên filter hiện tại, theo path canonical của trang. */
  buildPaginationHref: (canonicalPath: string) => string;
};

/** Single-select storefront gender behavior: clicking the active value clears it. */
export function toggleCatalogGenderFilter(
  current: string | undefined,
  clicked: "Nam" | "Nữ",
): "Nam" | "Nữ" | undefined {
  return current === clicked ? undefined : clicked;
}

/**
 * Parse + validate searchParams dùng chung cho 4 trang archive sản phẩm
 * (/sp, /tim-kiem, /danh-muc/[slug], /brands/[slug]). Gom khối
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
  const brandParsed = parseCatalogSlugList(params["pwb-brand"] ?? params.brand, "pwb-brand", 16);
  const colorParsed = parseCatalogSlugList(params.filter_color, "filter_color", 16);
  const finishParsed = parseCatalogSlugList(params.filter_finish, "filter_finish", 8);
  const genderValues = readSearchParamValues(params.filter_gender)
    .map((value) => value.trim().toLowerCase())
    .map((value) => value === "nam" ? "Nam" : value === "nu" || value === "nữ" ? "Nữ" : null)
    .filter((value): value is "Nam" | "Nữ" => value !== null);
  // The public contract is single-select. Older articles may still emit
  // repeated filter_gender values; keep the first supported value so those
  // URLs continue to show products instead of becoming an empty filter.
  const genderParsed = { value: genderValues[0], error: null as string | null };
  const rawSizeValues = readSearchParamValues(params["kich-co"]);
  const invalidSize = rawSizeValues.find((value) => value.trim().length > 32);
  const normalizedSizes = rawSizeValues
    .map(normalizeSizeFilterToken)
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index);
  const sizeError = invalidSize
    ? `Tham số "kich-co" không được dài quá 32 ký tự.`
    : null;
  const minPriceParsed = parseCatalogPriceParam(params.min_price, "min_price");
  const maxPriceParsed = parseCatalogPriceParam(params.max_price, "max_price");
  const inStockParsed = parseCatalogBooleanParam(params.in_stock, "in_stock");
  // A legacy URL can contain the two ends in reverse order. It is still a usable
  // URL: swap them before the first product request, then the facet response can
  // clamp and snap them to the actual range for this catalog context.
  if (minPriceParsed.value != null && maxPriceParsed.value != null
    && minPriceParsed.value > maxPriceParsed.value) {
    [minPriceParsed.value, maxPriceParsed.value] = [maxPriceParsed.value, minPriceParsed.value];
  }
  const orderbyParam = readSingleSearchParam(params.orderby);
  const orderbyError = orderbyParam && !isCatalogOrderbyValue(orderbyParam) ? ORDERBY_INVALID_MESSAGE : null;
  const sortParsed = parseSortParam(params.sort, PRODUCT_SORT_VALUES, DEFAULT_SORT);
  const orderbyCurrent = isCatalogOrderbyValue(orderbyParam)
    ? orderbyParam
    : productSortToOrderby(sortParsed.value ?? DEFAULT_SORT);
  const productSort = isCatalogOrderbyValue(orderbyParam)
    ? wpOrderbyToProductSort(orderbyParam, DEFAULT_SORT)
    : sortParsed.value;

  const category = includeCategory ? categoryParsed.value : undefined;

  const validationErrors = collectErrors(
    qParsed.error,
    pageParsed.error,
    sizeError,
    includeCategory ? categoryParsed.error : null,
    brandParsed.error,
    colorParsed.error,
    finishParsed.error,
    genderParsed.error,
    sizeParsed.error,
    minPriceParsed.error,
    maxPriceParsed.error,
    inStockParsed.error,
    orderbyError,
    orderbyParam ? null : sortParsed.error,
  );

  const filters: CatalogListFilters = {
    q: qParsed.value,
    category,
    brand: brandParsed.value,
    color: colorParsed.value,
    finish: finishParsed.value,
    gender: genderParsed.value,
    size: normalizedSizes,
    minPrice: minPriceParsed.value,
    maxPrice: maxPriceParsed.value,
    inStock: inStockParsed.value,
  };

  const currentFilters: CatalogFilterState = {
    q: filters.q,
    category: filters.category,
    brand: filters.brand,
    color: filters.color,
    finish: filters.finish,
    gender: filters.gender,
    size: filters.size,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    inStock: filters.inStock,
  };

  const buildPaginationHref = (canonicalPath: string) =>
    `${canonicalPath}${buildQueryString({
      size: sizeParsed.value !== DEFAULT_PAGE_SIZE ? sizeParsed.value : undefined,
      orderby: orderbyCurrent !== DEFAULT_CATALOG_ORDERBY ? orderbyCurrent : undefined,
      ...(includeCategory ? { category: filters.category } : {}),
      "pwb-brand": filters.brand,
      q: filters.q,
      filter_color: filters.color,
      filter_finish: filters.finish,
      filter_gender: filters.gender,
      "kich-co": filters.size.length ? filters.size : undefined,
      min_price: filters.minPrice,
      max_price: filters.maxPrice,
      in_stock: filters.inStock ? "true" : undefined,
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

function parseCatalogSlugList(
  value: RouteSearchParams[string],
  field: string,
  maxItems: number,
): { value: string[]; error: string | null } {
  const values = readSearchParamValues(value)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index);
  const invalid = values.find((item) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item));
  if (invalid) return { value: [], error: `Tham số "${field}" không hợp lệ.` };
  if (values.length > maxItems) {
    return { value: values.slice(0, maxItems), error: `Tham số "${field}" có quá nhiều giá trị.` };
  }
  return { value: values, error: null };
}

function parseCatalogBooleanParam(
  value: RouteSearchParams[string],
  field: string,
): { value: boolean; error: string | null } {
  const raw = readSingleSearchParam(value)?.trim().toLowerCase();
  if (!raw || raw === "false" || raw === "0") return { value: false, error: null };
  if (raw === "true" || raw === "1") return { value: true, error: null };
  return { value: false, error: `Tham số "${field}" không hợp lệ.` };
}

function parseCatalogPriceParam(value: RouteSearchParams[string], field: string) {
  const raw = readSingleSearchParam(value);
  if (!raw) return { value: undefined as number | undefined, error: null as string | null };

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return {
      value: undefined as number | undefined,
      error: `Tham số "${field}" phải là số.`,
    };
  }

  // Numeric but unreasonable values are corrected by the dynamic facet range;
  // they are not a red validation state in the storefront.
  return {
    value: Math.min(PRICE_PARAM_MAX, Math.max(0, Math.round(parsed))),
    error: null as string | null,
  };
}

function normalizeSizeFilterToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const colon = trimmed.indexOf(":");
  const namespace = colon > 0 ? trimmed.slice(0, colon).trim().toLowerCase().replace(/\s+/g, "-") : "";
  const value = (colon > 0 ? trimmed.slice(colon + 1) : trimmed)
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/^2XL$/, "XXL")
    .replace(/^XXXL$/, "3XL");
  if (!value) return "";
  return namespace ? `${namespace}:${value}` : value;
}
