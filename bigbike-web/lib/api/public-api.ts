import type {
  ApiDataResponse,
  ApiErrorDetail,
  ApiErrorResponse,
  ApiListResponse,
  Article,
  Brand,
  CatalogFacets,
  Category,
  ClientError,
  DataResult,
  HomeHighlightItem,
  HomeSlider,
  HomeVideo,
  LegacyDiscontinuedProduct,
  ListResult,
  PublicMenu,
  PublicSiteSetting,
  Product,
} from "@/lib/contracts/public";
import { withFlatHighlights } from "@/lib/contracts/public";

import type { OrderDetail } from "@/lib/contracts/commerce";
import { env } from "@/env";

// BIGBIKE_API_BASE_URL (server-only, vd hostname nội bộ Docker) chỉ dùng được khi
// module này chạy trên server. Module này còn bị import bởi component "use client"
// (vd ProductView cho preview iframe) — browser không resolve được hostname nội bộ
// nên phải luôn dùng NEXT_PUBLIC_API_BASE_URL, và không được đụng vào biến server-only
// (t3-env throw ngay khi truy cập biến server từ client bundle).
const API_BASE_URL =
  (typeof window === "undefined" ? env.BIGBIKE_API_BASE_URL : undefined) ??
  env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8080";

const DEFAULT_META_ERROR = {
  status: 500,
  code: "WEB_API_ERROR",
  message: "Không thể tải dữ liệu từ backend.",
  details: [] as ApiErrorDetail[],
} satisfies ClientError;

type RequestQuery = Record<string, string | string[] | number | boolean | undefined>;

class ApiRequestError extends Error {
  clientError: ClientError;

  constructor(clientError: ClientError) {
    super(clientError.message);
    this.name = "ApiRequestError";
    this.clientError = clientError;
  }
}

function toUrl(path: string, query?: RequestQuery): string {
  const url = new URL(path, API_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === "") {
        continue;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => url.searchParams.append(key, String(item)));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function decodeJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isEnglishQuery(query?: RequestQuery): boolean {
  return query?.lang === "en";
}

function englishErrorMessage(status: number): string {
  if (status === 404) return "The requested data could not be found.";
  if (status >= 500) return "The service is busy. Please try again.";
  return "Unable to load data from the service.";
}

function parseError(status: number, payload: unknown, query?: RequestQuery): ClientError {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object"
  ) {
    const apiError = (payload as ApiErrorResponse).error;
    return {
      status,
      code: apiError.code ?? DEFAULT_META_ERROR.code,
      message: isEnglishQuery(query)
        ? englishErrorMessage(status)
        : apiError.message ?? DEFAULT_META_ERROR.message,
      details: apiError.details ?? [],
    };
  }

  return {
    ...DEFAULT_META_ERROR,
    status,
    message:
      status === 404
        ? isEnglishQuery(query) ? englishErrorMessage(status) : "Không tìm thấy dữ liệu yêu cầu."
        : status >= 500
          ? isEnglishQuery(query) ? englishErrorMessage(status) : "Hệ thống đang bận, vui lòng thử lại."
          : isEnglishQuery(query) ? englishErrorMessage(status) : DEFAULT_META_ERROR.message,
  };
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["data", "content", "items", "results"]) {
      const direct = record[key];
      if (Array.isArray(direct)) {
        return direct as T[];
      }
      if (direct && typeof direct === "object") {
        const nested = direct as Record<string, unknown>;
        for (const nestedKey of ["data", "content", "items", "results"]) {
          if (Array.isArray(nested[nestedKey])) {
            return nested[nestedKey] as T[];
          }
        }
      }
    }
  }

  return [];
}

function paginationFrom(value: unknown): ListResult<unknown>["pagination"] {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("pagination" in record) {
      return (record.pagination as ListResult<unknown>["pagination"]) ?? null;
    }
    if (record.data && typeof record.data === "object" && "pagination" in record.data) {
      return ((record.data as Record<string, unknown>).pagination as ListResult<unknown>["pagination"]) ?? null;
    }
  }

  return null;
}

// revalidate=0 → cache: "no-store" (search, user-specific). Otherwise ISR + optional tags.
async function requestJson<T>(
  path: string,
  query?: RequestQuery,
  revalidate = 3600,
  tags?: string[],
): Promise<T> {
  const init: RequestInit = {
    method: "GET",
    headers: { Accept: "application/json" },
    ...(revalidate === 0
      ? { cache: "no-store" }
      : { next: { revalidate, ...(tags && tags.length > 0 ? { tags } : {}) } }),
  };
  const response = await fetch(toUrl(path, query), init);

  const payload = await decodeJson(response);
  if (!response.ok) {
    throw new ApiRequestError(parseError(response.status, payload, query));
  }

  return payload as T;
}

function toClientError(error: unknown, query?: RequestQuery): ClientError {
  if (error instanceof ApiRequestError) {
    return error.clientError;
  }
  if (error instanceof Error) {
    return {
      ...DEFAULT_META_ERROR,
      message: error.message || (isEnglishQuery(query) ? "Unable to load data from the service." : DEFAULT_META_ERROR.message),
    };
  }
  return DEFAULT_META_ERROR;
}

async function loadList<T>(
  endpoint: string,
  query: RequestQuery,
  revalidate = 3600,
  tags?: string[],
): Promise<ListResult<T>> {
  try {
    const response = await requestJson<ApiListResponse<T>>(endpoint, query, revalidate, tags);
    return {
      data: asArray<T>(response),
      pagination: paginationFrom(response),
      error: null,
    };
  } catch (error) {
    return {
      data: [],
      pagination: null,
      error: toClientError(error, query),
    };
  }
}

async function loadArrayDataWithQuery<T>(
  endpoint: string,
  query: RequestQuery,
  revalidate = 3600,
  tags?: string[],
): Promise<DataResult<T[]>> {
  try {
    const response = await requestJson<ApiDataResponse<unknown>>(endpoint, query, revalidate, tags);
    return {
      data: asArray<T>(response),
      error: null,
    };
  } catch (error) {
    return {
      data: [],
      error: toClientError(error, query),
    };
  }
}

async function loadDataWithQuery<T>(
  endpoint: string,
  query: RequestQuery,
  revalidate = 3600,
  tags?: string[],
): Promise<DataResult<T>> {
  try {
    const response = await requestJson<ApiDataResponse<T>>(endpoint, query, revalidate, tags);
    return {
      data: response.data,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: toClientError(error, query),
    };
  }
}

// PRODUCT_SORT_VALUES sống ở lib/constants/catalog (client-safe) — re-export để các
// consumer cũ (import từ public-api) không phải đổi; parseCatalogListParams import
// thẳng từ constants để KHÔNG kéo module server này vào client bundle.
export { PRODUCT_SORT_VALUES } from "@/lib/constants/catalog";

 type ProductListQuery = {
  page?: number;
  size?: number;
  sort?: string;
  category?: string;
  brand?: string | string[];
  q?: string;
  filterColor?: string | string[];
  filterFinish?: string | string[];
  filterGender?: string;
  sizeFilter?: string | string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  /** Filter to a single homepage placement slot. */
  homepageBlock?: "NONE" | "FEATURED_GRID";
  /** Content language: "vi" (default) or "en". English falls back to Vietnamese per PRODUCT_RULE_002. */
  lang?: string;
};

export function listProducts(query: ProductListQuery): Promise<ListResult<Product>> {
  return loadList(
    "/api/v1/products",
    {
      page: query.page,
      size: query.size,
      sort: query.sort ?? "createdAt:desc",
      category: query.category,
      "pwb-brand": query.brand,
      q: query.q,
      filter_color: query.filterColor,
      filter_finish: query.filterFinish,
      filter_gender: query.filterGender,
      "kich-co": query.sizeFilter,
      min_price: query.minPrice,
      max_price: query.maxPrice,
      in_stock: query.inStock ? true : undefined,
      homepage_block: query.homepageBlock,
      lang: query.lang,
    },
    3600,
    // Cache key must include locale so vi/en don't share entries.
    ["products", `lang:${query.lang ?? "vi"}`],
  );
}

export async function getProductBySlug(slug: string, lang?: string): Promise<DataResult<Product>> {
  const result = await loadDataWithQuery<Product>(
    `/api/v1/products/${slug}`,
    { lang },
    3600,
    ["products", `product:${slug}`, `lang:${lang ?? "vi"}`],
  );
  return result.data ? { ...result, data: withFlatHighlights(result.data) } : result;
}

/** Exact lookup for an admin-managed historical product URL, never a catalog list item. */
export function getLegacyDiscontinuedProduct(
  slug: string,
  lang?: string,
): Promise<DataResult<LegacyDiscontinuedProduct>> {
  return loadDataWithQuery(
    `/api/v1/legacy-discontinued-products/${slug}`,
    { lang },
    0,
  );
}

 type CategoryListQuery = {
  page?: number;
  size?: number;
  sort?: string;
  filterHome?: boolean;
  showOnHomepage?: boolean;
  /** Content language: "vi" (default) or "en". English falls back to Vietnamese per CATEGORY_RULE_002. */
  lang?: string;
};

export function listCategories(query: CategoryListQuery): Promise<ListResult<Category>> {
  return loadList(
    "/api/v1/categories",
    {
      page: query.page,
      size: query.size,
      sort: query.sort ?? "sortOrder:asc",
      filterHome: query.filterHome ? "true" : undefined,
      showOnHomepage: query.showOnHomepage ? "true" : undefined,
      lang: query.lang,
    },
    3600,
    ["categories", `lang:${query.lang ?? "vi"}`],
  );
}

export function getCategoryBySlug(slug: string, lang?: string): Promise<DataResult<Category>> {
  return loadDataWithQuery(
    `/api/v1/categories/${slug}`,
    { lang },
    3600,
    ["categories", `category:${slug}`, `lang:${lang ?? "vi"}`],
  );
}

 type BrandListQuery = {
  page?: number;
  size?: number;
  sort?: string;
  showOnHomepage?: boolean;
  /** Content language: "vi" (default) or "en". English falls back to Vietnamese per BRAND_RULE_002. */
  lang?: string;
};

export function listBrands(query: BrandListQuery): Promise<ListResult<Brand>> {
  return loadList(
    "/api/v1/brands",
    {
      page: query.page,
      size: query.size,
      sort: query.sort ?? "name:asc",
      showOnHomepage: query.showOnHomepage ? "true" : undefined,
      lang: query.lang,
    },
    3600,
    ["brands", `lang:${query.lang ?? "vi"}`],
  );
}

export function getBrandBySlug(slug: string, lang?: string): Promise<DataResult<Brand>> {
  return loadDataWithQuery(
    `/api/v1/brands/${slug}`,
    { lang },
    3600,
    ["brands", `brand:${slug}`, `lang:${lang ?? "vi"}`],
  );
}

type CatalogFacetsQuery = {
  category?: string;
  brand?: string | string[];
  q?: string;
  filterColor?: string | string[];
  filterFinish?: string | string[];
  filterGender?: string;
  sizeFilter?: string | string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  /** Content language: "vi" (default) or "en". Facet labels fall back to Vietnamese. */
  lang?: string;
};

/** Product counts per filter value for the catalog sidebar. See /api/v1/catalog/facets. */
export function getCatalogFacets(query: CatalogFacetsQuery): Promise<DataResult<CatalogFacets>> {
  return loadDataWithQuery<CatalogFacets>(
    "/api/v1/catalog/facets",
    {
      category: query.category,
      "pwb-brand": query.brand,
      q: query.q,
      filter_color: query.filterColor,
      filter_finish: query.filterFinish,
      filter_gender: query.filterGender,
      "kich-co": query.sizeFilter,
      min_price: query.minPrice,
      max_price: query.maxPrice,
      in_stock: query.inStock ? true : undefined,
      lang: query.lang,
    },
    3600,
    ["products", "categories", "brands", `lang:${query.lang ?? "vi"}`],
  );
}

 type ArticleListQuery = {
  page?: number;
  size?: number;
  sort?: string;
  q?: string;
  featured?: boolean;
  homeExperience?: boolean;
  lang?: string;
};

export function listArticles(query: ArticleListQuery): Promise<ListResult<Article>> {
  return loadList(
    "/api/v1/articles",
    {
      page: query.page,
      size: query.size,
      sort: query.sort ?? "publishedAt:desc",
      q: query.q,
      featured: query.featured ? "true" : undefined,
      homeExperience: query.homeExperience ? "true" : undefined,
      lang: query.lang,
    },
    3600,
    ["articles", `lang:${query.lang ?? "vi"}`],
  );
}

export function getArticleBySlug(slug: string, lang?: string): Promise<DataResult<Article>> {
  return loadDataWithQuery(`/api/v1/articles/${slug}`, { lang }, 3600, ["articles", `article:${slug}`, `lang:${lang ?? "vi"}`]);
}

export function getPublicMenu(location: string, lang?: string): Promise<DataResult<PublicMenu>> {
  return loadDataWithQuery(`/api/v1/menus/${location}`, { lang }, 3600, ["menus", `lang:${lang ?? "vi"}`]);
}

export function listPublicSettings(lang?: string): Promise<DataResult<PublicSiteSetting[]>> {
  return loadArrayDataWithQuery("/api/v1/settings/public", { lang }, 3600, ["settings", `lang:${lang ?? "vi"}`]);
}

/** Active sliders for a given placement location (e.g. "home", "category_sidebar"). */
 function listSliders(location: string): Promise<DataResult<HomeSlider[]>> {
  return loadArrayDataWithQuery<HomeSlider>("/api/v1/sliders", { location }, 3600, ["sliders"]);
}

export function listHomeSliders(): Promise<DataResult<HomeSlider[]>> {
  return listSliders("home");
}

export function listHomeVideos(lang?: string): Promise<DataResult<HomeVideo[]>> {
  return loadArrayDataWithQuery<HomeVideo>("/api/v1/home-videos", { lang }, 300, ["home-videos", `lang:${lang ?? "vi"}`]);
}

export function listHomeHighlights(lang?: string): Promise<DataResult<HomeHighlightItem[]>> {
  return loadArrayDataWithQuery<HomeHighlightItem>("/api/v1/home/category-highlights", { lang }, 300, ["home-highlights", `lang:${lang ?? "vi"}`]);
}

export function getOrderLookup(orderNumber: string, orderKey: string, lang?: string): Promise<DataResult<OrderDetail>> {
  if (!orderNumber || !orderKey) {
    return Promise.resolve({
      data: null,
      error: {
        status: 400,
        code: "VALIDATION_ERROR",
        message: lang === "en" ? "The order details are invalid." : "Tham số đơn hàng không hợp lệ.",
        details: [],
      },
    });
  }

  return loadDataWithQuery<OrderDetail>(
    "/api/v1/orders/lookup",
    {
      orderNumber,
      orderKey,
      lang,
    },
    0,
  );
}

// Cross-domain search helpers (`search`, `searchSuggest`) removed 2026-07-15 (AUD-060):
// no caller. The search page fetches products directly and the header dropdown calls the
// Next.js route /app/api/search-suggest, which proxies the backend /api/v1/search-suggest.
