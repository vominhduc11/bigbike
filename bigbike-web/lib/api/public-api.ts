import type {
  ApiDataResponse,
  ApiErrorDetail,
  ApiErrorResponse,
  ApiListResponse,
  Article,
  Brand,
  Category,
  ClientError,
  DataResult,
  HomeSlider,
  HomeVideo,
  ListResult,
  Page,
  PublicMenu,
  PublicSiteSetting,
  Product,
} from "@/lib/contracts/public";
import type { OrderDetail } from "@/lib/contracts/commerce";
import { env } from "@/env";

const API_BASE_URL =
  env.BIGBIKE_API_BASE_URL ??
  env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8080";

const DEFAULT_META_ERROR = {
  status: 500,
  code: "WEB_API_ERROR",
  message: "Không thể tải dữ liệu từ backend.",
  details: [] as ApiErrorDetail[],
} satisfies ClientError;

type RequestQuery = Record<string, string | number | undefined>;

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
      url.searchParams.set(key, String(value));
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

function parseError(status: number, payload: unknown): ClientError {
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
      message: apiError.message ?? DEFAULT_META_ERROR.message,
      details: apiError.details ?? [],
    };
  }

  return {
    ...DEFAULT_META_ERROR,
    status,
    message:
      status === 404
        ? "Không tìm thấy dữ liệu yêu cầu."
        : status >= 500
          ? "Hệ thống đang bận, vui lòng thử lại."
          : DEFAULT_META_ERROR.message,
  };
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
    throw new ApiRequestError(parseError(response.status, payload));
  }

  return payload as T;
}

function toClientError(error: unknown): ClientError {
  if (error instanceof ApiRequestError) {
    return error.clientError;
  }
  if (error instanceof Error) {
    return {
      ...DEFAULT_META_ERROR,
      message: error.message || DEFAULT_META_ERROR.message,
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
      data: response.data ?? [],
      pagination: response.pagination,
      error: null,
    };
  } catch (error) {
    return {
      data: [],
      pagination: null,
      error: toClientError(error),
    };
  }
}

async function loadData<T>(
  endpoint: string,
  revalidate = 3600,
  tags?: string[],
): Promise<DataResult<T>> {
  try {
    const response = await requestJson<ApiDataResponse<T>>(endpoint, undefined, revalidate, tags);
    return {
      data: response.data,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: toClientError(error),
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
      error: toClientError(error),
    };
  }
}

export const PRODUCT_SORT_VALUES = [
  "createdAt:desc",
  "createdAt:asc",
  "name:asc",
  "name:desc",
  "price:asc",
  "price:desc",
] as const;

export const BRAND_SORT_VALUES = [
  "name:asc",
  "name:desc",
  "createdAt:desc",
  "createdAt:asc",
] as const;

export const ARTICLE_SORT_VALUES = [
  "publishedAt:desc",
  "publishedAt:asc",
  "createdAt:desc",
  "createdAt:asc",
  "title:asc",
  "title:desc",
] as const;

export type ProductListQuery = {
  page?: number;
  size?: number;
  sort?: string;
  category?: string;
  brand?: string;
  q?: string;
  filterColor?: string;
  minPrice?: number;
  maxPrice?: number;
  /** Filter to a single homepage placement slot. */
  homepageBlock?: "NONE" | "FEATURED_GRID" | "RECOMMENDED_CAROUSEL";
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
      min_price: query.minPrice,
      max_price: query.maxPrice,
      homepage_block: query.homepageBlock,
    },
    3600,
    ["products"],
  );
}

export function getProductBySlug(slug: string): Promise<DataResult<Product>> {
  return loadData(`/api/v1/products/${slug}`, 3600, ["products", `product:${slug}`]);
}

export type CategoryListQuery = {
  page?: number;
  size?: number;
  sort?: string;
  filterHome?: boolean;
  showOnHomepage?: boolean;
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
    },
    3600,
    ["categories"],
  );
}

export function getCategoryBySlug(slug: string): Promise<DataResult<Category>> {
  return loadData(`/api/v1/categories/${slug}`, 3600, ["categories", `category:${slug}`]);
}

export type BrandListQuery = {
  page?: number;
  size?: number;
  sort?: string;
};

export function listBrands(query: BrandListQuery): Promise<ListResult<Brand>> {
  return loadList(
    "/api/v1/brands",
    {
      page: query.page,
      size: query.size,
      sort: query.sort ?? "name:asc",
    },
    3600,
    ["brands"],
  );
}

export function getBrandBySlug(slug: string): Promise<DataResult<Brand>> {
  return loadData(`/api/v1/brands/${slug}`, 3600, ["brands", `brand:${slug}`]);
}

export type ArticleListQuery = {
  page?: number;
  size?: number;
  sort?: string;
  category?: string;
  q?: string;
  featured?: boolean;
};

export function listArticles(query: ArticleListQuery): Promise<ListResult<Article>> {
  return loadList(
    "/api/v1/articles",
    {
      page: query.page,
      size: query.size,
      sort: query.sort ?? "publishedAt:desc",
      category: query.category,
      q: query.q,
      featured: query.featured ? "true" : undefined,
    },
    3600,
    ["articles"],
  );
}

export function getArticleBySlug(slug: string): Promise<DataResult<Article>> {
  return loadData(`/api/v1/articles/${slug}`, 3600, ["articles", `article:${slug}`]);
}

export function listPages(): Promise<ListResult<Page>> {
  return loadList("/api/v1/pages", {}, 3600, ["pages"]);
}

export function getPageBySlug(slug: string): Promise<DataResult<Page>> {
  return loadData(`/api/v1/pages/${slug}`, 3600, ["pages", `page:${slug}`]);
}

export function getPublicMenu(location: string): Promise<DataResult<PublicMenu>> {
  return loadData(`/api/v1/menus/${location}`, 3600, ["menus"]);
}

export function listPublicSettings(): Promise<DataResult<PublicSiteSetting[]>> {
  return loadData("/api/v1/settings/public", 3600, ["settings"]);
}

export function listHomeSliders(): Promise<DataResult<HomeSlider[]>> {
  return loadDataWithQuery<HomeSlider[]>("/api/v1/sliders", { location: "home" }, 3600, ["sliders"]);
}

export function listHomeVideos(): Promise<DataResult<HomeVideo[]>> {
  return loadData<HomeVideo[]>("/api/v1/home-videos", 3600, ["home-videos"]);
}

export function getOrderLookup(orderNumber: string, orderKey: string): Promise<DataResult<OrderDetail>> {
  if (!orderNumber || !orderKey) {
    return Promise.resolve({
      data: null,
      error: {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Tham so don hang khong hop le.",
        details: [],
      },
    });
  }

  return loadDataWithQuery<OrderDetail>(
    "/api/v1/orders/lookup",
    {
      orderNumber,
      orderKey,
    },
    0,
  );
}

// ── Cross-domain search ──────────────────────────────────────────────────────

export type SearchResults = {
  query: string;
  products: Product[];
  articles: Article[];
};

export type SearchTypeFilter = "product" | "article";

export type SearchQuery = {
  q: string;
  types?: SearchTypeFilter[];
  limit?: number;
};

export async function search(query: SearchQuery): Promise<DataResult<SearchResults>> {
  const params: RequestQuery = {
    q: query.q,
    limit: query.limit,
  };
  if (query.types && query.types.length > 0) {
    params.type = query.types.join(",");
  }
  try {
    const response = await requestJson<ApiDataResponse<SearchResults>>(
      "/api/v1/search",
      params,
      0, // search is user-specific — no-store
    );
    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: toClientError(error) };
  }
}

