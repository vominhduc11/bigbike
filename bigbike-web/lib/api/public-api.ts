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
  ListResult,
  Page,
  Product,
} from "@/lib/contracts/public";
import {
  getArticleBySlugFallback,
  getBrandBySlugFallback,
  getCategoryBySlugFallback,
  getPageBySlugFallback,
  getProductBySlugFallback,
  listArticlesFallback,
  listBrandsFallback,
  listCategoriesFallback,
  listProductsFallback,
} from "@/lib/mock/public-fallback";

const API_BASE_URL =
  process.env.BIGBIKE_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8080";

const CAN_USE_DEV_FALLBACK =
  process.env.NODE_ENV !== "production" &&
  process.env.BIGBIKE_DISABLE_DEV_FALLBACK !== "true";

const DEFAULT_META_ERROR = {
  status: 500,
  code: "WEB_API_ERROR",
  message: "Khong the tai du lieu tu backend.",
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
        ? "Khong tim thay du lieu yeu cau."
        : status >= 500
          ? "He thong dang ban, vui long thu lai."
          : DEFAULT_META_ERROR.message,
  };
}

async function requestJson<T>(path: string, query?: RequestQuery): Promise<T> {
  const response = await fetch(toUrl(path, query), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

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
  fallbackFactory: () => ApiListResponse<T>,
): Promise<ListResult<T>> {
  try {
    const response = await requestJson<ApiListResponse<T>>(endpoint, query);
    return {
      data: response.data,
      pagination: response.pagination,
      error: null,
      fromFallback: false,
    };
  } catch (error) {
    if (CAN_USE_DEV_FALLBACK) {
      const fallback = fallbackFactory();
      return {
        data: fallback.data,
        pagination: fallback.pagination,
        error: toClientError(error),
        fromFallback: true,
      };
    }

    return {
      data: [],
      pagination: null,
      error: toClientError(error),
      fromFallback: false,
    };
  }
}

async function loadData<T>(
  endpoint: string,
  fallbackFactory: () => ApiDataResponse<T> | null,
): Promise<DataResult<T>> {
  try {
    const response = await requestJson<ApiDataResponse<T>>(endpoint);
    return {
      data: response.data,
      error: null,
      fromFallback: false,
    };
  } catch (error) {
    if (CAN_USE_DEV_FALLBACK) {
      const fallback = fallbackFactory();
      if (fallback) {
        return {
          data: fallback.data,
          error: toClientError(error),
          fromFallback: true,
        };
      }
    }

    return {
      data: null,
      error: toClientError(error),
      fromFallback: false,
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

export const CATEGORY_SORT_VALUES = [
  "sortOrder:asc",
  "sortOrder:desc",
  "name:asc",
  "name:desc",
  "createdAt:desc",
  "createdAt:asc",
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
  page: number;
  size: number;
  sort: string;
  category?: string;
  brand?: string;
  q?: string;
};

export function listProducts(query: ProductListQuery): Promise<ListResult<Product>> {
  return loadList(
    "/api/v1/products",
    {
      page: query.page,
      size: query.size,
      sort: query.sort,
      category: query.category,
      brand: query.brand,
      q: query.q,
    },
    () => listProductsFallback(query),
  );
}

export function getProductBySlug(slug: string): Promise<DataResult<Product>> {
  return loadData(`/api/v1/products/${slug}`, () => getProductBySlugFallback(slug));
}

export type CategoryListQuery = {
  page: number;
  size: number;
  sort: string;
};

export function listCategories(query: CategoryListQuery): Promise<ListResult<Category>> {
  return loadList(
    "/api/v1/categories",
    {
      page: query.page,
      size: query.size,
      sort: query.sort,
    },
    () => listCategoriesFallback(query),
  );
}

export function getCategoryBySlug(slug: string): Promise<DataResult<Category>> {
  return loadData(`/api/v1/categories/${slug}`, () => getCategoryBySlugFallback(slug));
}

export type BrandListQuery = {
  page: number;
  size: number;
  sort: string;
};

export function listBrands(query: BrandListQuery): Promise<ListResult<Brand>> {
  return loadList(
    "/api/v1/brands",
    {
      page: query.page,
      size: query.size,
      sort: query.sort,
    },
    () => listBrandsFallback(query),
  );
}

export function getBrandBySlug(slug: string): Promise<DataResult<Brand>> {
  return loadData(`/api/v1/brands/${slug}`, () => getBrandBySlugFallback(slug));
}

export type ArticleListQuery = {
  page: number;
  size: number;
  sort: string;
  category?: string;
  q?: string;
};

export function listArticles(query: ArticleListQuery): Promise<ListResult<Article>> {
  return loadList(
    "/api/v1/articles",
    {
      page: query.page,
      size: query.size,
      sort: query.sort,
      category: query.category,
      q: query.q,
    },
    () => listArticlesFallback(query),
  );
}

export function getArticleBySlug(slug: string): Promise<DataResult<Article>> {
  return loadData(`/api/v1/articles/${slug}`, () => getArticleBySlugFallback(slug));
}

export function getPageBySlug(slug: string): Promise<DataResult<Page>> {
  return loadData(`/api/v1/pages/${slug}`, () => getPageBySlugFallback(slug));
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
    );
    return { data: response.data, error: null, fromFallback: false };
  } catch (error) {
    return { data: null, error: toClientError(error), fromFallback: false };
  }
}

