import type {
  Cart,
  CheckoutPayload,
  CustomerAddress,
  CustomerAuthData,
  CustomerProfile,
  OrderDetail,
  OrderListItem,
  OrderSummary,
  QuickBuyPayload,
  SaveAddressPayload,
  UpdateCustomerProfilePayload,
} from "@/lib/contracts/commerce";
import type { Article, Brand, Category, Product, PublicMenu } from "@/lib/contracts/public";
import { withFlatHighlights } from "@/lib/contracts/public";
import { env } from "@/env";

const API_BASE_URL = env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)bb_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function clientRequest<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...extraHeaders };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    const csrf = getCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (payload === null) throw new Error("Máy chủ không trả về dữ liệu hợp lệ.");
  return (payload as { data: T }).data ?? (payload as T);
}

// ── Cart ─────────────────────────────────────────────────────────────────────

export function fetchCart(): Promise<Cart> {
  return clientRequest("GET", "/api/v1/cart");
}

export function addCartItem(productId: string, quantity: number, variantId?: string): Promise<Cart> {
  return clientRequest("POST", "/api/v1/cart/items", { productId, quantity, productVariantId: variantId ?? null });
}

export function updateCartItem(itemId: string, quantity: number): Promise<Cart> {
  return clientRequest("PATCH", `/api/v1/cart/items/${itemId}`, { quantity });
}

export function removeCartItem(itemId: string): Promise<Cart> {
  return clientRequest("DELETE", `/api/v1/cart/items/${itemId}`);
}

export function clearCart(): Promise<Cart> {
  return clientRequest("DELETE", "/api/v1/cart/clear");
}

// ── Checkout ──────────────────────────────────────────────────────────────────

export function submitCheckout(payload: CheckoutPayload, idempotencyKey?: string): Promise<OrderSummary> {
  const extra = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined;
  return clientRequest("POST", "/api/v1/checkout", payload, extra);
}

 export type PublicSetting = { settingKey: string; settingValue: string };

/**
 * List endpoint — parsed directly (not via `clientRequest`) so a `data: null`/missing
 * envelope field defaults to `[]` instead of falling back to the whole response object
 * (which would make callers' `.find()` throw on a non-array).
 */
export async function fetchPublicSettings(lang?: string): Promise<PublicSetting[]> {
  const qs = lang ? `?lang=${encodeURIComponent(lang)}` : "";
  const res = await fetch(`${API_BASE_URL}/api/v1/settings/public${qs}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  const body = (payload ?? {}) as { data?: PublicSetting[] };
  return body.data ?? [];
}

export function fetchPublicMenu(location: string, lang?: string): Promise<PublicMenu> {
  const qs = lang ? `?lang=${encodeURIComponent(lang)}` : "";
  return clientRequest("GET", `/api/v1/menus/${location}${qs}`);
}

// ── Catalog ───────────────────────────────────────────────────────────────────

/** Append `?lang=` only when a non-empty language is supplied (vi is backend default). */
function withLang(path: string, lang?: string): string {
  return lang ? `${path}?lang=${encodeURIComponent(lang)}` : path;
}

/**
 * Client-side product detail fetch — used by the comparison page (reads the
 * product list from localStorage, needs the full payload incl. `specifications`)
 * AND by the client-side content localizer (refetch in EN on locale switch).
 */
export async function fetchPublicProduct(slug: string, lang?: string): Promise<Product> {
  const product = await clientRequest<Product>("GET", withLang(`/api/v1/products/${encodeURIComponent(slug)}`, lang));
  return withFlatHighlights(product);
}

/** Client-side detail fetches — used by the content localizer to swap detail-page
 *  data to EN after a locale switch, keeping the server render static `vi` (ISR). */
export function fetchPublicArticle(slug: string, lang?: string): Promise<Article> {
  return clientRequest("GET", withLang(`/api/v1/articles/${encodeURIComponent(slug)}`, lang));
}

export function fetchPublicBrand(slug: string, lang?: string): Promise<Brand> {
  return clientRequest("GET", withLang(`/api/v1/brands/${encodeURIComponent(slug)}`, lang));
}

export function fetchPublicCategory(slug: string, lang?: string): Promise<Category> {
  return clientRequest("GET", withLang(`/api/v1/categories/${encodeURIComponent(slug)}`, lang));
}

 type PublicProductListQuery = {
  page?: number;
  size?: number;
  sort?: string;
  category?: string;
  brand?: string;
  q?: string;
  filterColor?: string;
  filterGender?: string;
  minPrice?: number;
  maxPrice?: number;
  homepageBlock?: "NONE" | "FEATURED_GRID";
  lang?: string;
};

export type PublicProductListResult = {
  data: Product[];
  pagination: { page: number; totalPages: number; totalItems?: number | null } | null;
};

/** Append a query param only when the value is meaningful (skips undefined/null/empty string). */
function appendParam(qs: URLSearchParams, key: string, value: string | number | undefined) {
  if (value !== undefined && value !== null && `${value}` !== "") qs.set(key, `${value}`);
}

/**
 * Client-side catalog list fetch — dùng cho lưới sản phẩm CSR ở các trang archive
 * (danh mục / tất cả sản phẩm / tìm kiếm). Trang chỉ render shell tĩnh (ISR), lưới
 * lọc/phân trang fetch ở client theo searchParams. Param names khớp backend như
 * `listProducts` của public-api (pwb-brand, filter_color, min_price, max_price).
 */
export async function fetchPublicProductList(
  query: PublicProductListQuery,
): Promise<PublicProductListResult> {
  const qs = new URLSearchParams();
  const put = (k: string, v: string | number | undefined) => appendParam(qs, k, v);
  put("page", query.page);
  put("size", query.size);
  put("sort", query.sort ?? "createdAt:desc");
  put("category", query.category);
  put("pwb-brand", query.brand);
  put("q", query.q);
  put("filter_color", query.filterColor);
  put("filter_gender", query.filterGender);
  put("min_price", query.minPrice);
  put("max_price", query.maxPrice);
  put("homepage_block", query.homepageBlock);
  put("lang", query.lang);

  const res = await fetch(`${API_BASE_URL}/api/v1/products?${qs.toString()}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  const body = (payload ?? {}) as { data?: Product[]; pagination?: PublicProductListResult["pagination"] };
  return { data: body.data ?? [], pagination: body.pagination ?? null };
}

 type PublicArticleListQuery = {
  page?: number;
  size?: number;
  category?: string;
  q?: string;
  lang?: string;
};

export type PublicArticleListResult = {
  data: Article[];
  pagination: { page: number; totalPages: number; totalItems?: number | null } | null;
};

/** Client-side article list fetch — lưới tin tức CSR (lọc danh mục/tìm/phân trang). */
export async function fetchPublicArticleList(
  query: PublicArticleListQuery,
): Promise<PublicArticleListResult> {
  const qs = new URLSearchParams();
  const put = (k: string, v: string | number | undefined) => appendParam(qs, k, v);
  put("page", query.page);
  put("size", query.size);
  put("sort", "publishedAt:desc");
  put("category", query.category);
  put("q", query.q);
  put("lang", query.lang);

  const res = await fetch(`${API_BASE_URL}/api/v1/articles?${qs.toString()}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  const body = (payload ?? {}) as { data?: Article[]; pagination?: PublicArticleListResult["pagination"] };
  return { data: body.data ?? [], pagination: body.pagination ?? null };
}

export type PublicBrandListResult = {
  data: Brand[];
  pagination: { page: number; totalPages: number; totalItems?: number | null } | null;
};

/** Client-side brand list fetch — lưới thương hiệu CSR (phân trang/sắp xếp). */
export async function fetchPublicBrandList(
  query: { page?: number; size?: number; sort?: string; lang?: string },
): Promise<PublicBrandListResult> {
  const qs = new URLSearchParams();
  const put = (k: string, v: string | number | undefined) => appendParam(qs, k, v);
  put("page", query.page);
  put("size", query.size);
  put("sort", query.sort ?? "name:asc");
  put("lang", query.lang);

  const res = await fetch(`${API_BASE_URL}/api/v1/brands?${qs.toString()}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  const body = (payload ?? {}) as { data?: Brand[]; pagination?: PublicBrandListResult["pagination"] };
  return { data: body.data ?? [], pagination: body.pagination ?? null };
}

/** Client-side category list fetch — dùng cho lưới danh mục trang chủ refetch theo lang. */
export async function fetchPublicCategoryList(
  query: { size?: number; sort?: string; showOnHomepage?: boolean; lang?: string },
): Promise<Category[]> {
  const qs = new URLSearchParams();
  const put = (k: string, v: string | number | undefined) => appendParam(qs, k, v);
  put("size", query.size);
  put("sort", query.sort ?? "sortOrder:asc");
  if (query.showOnHomepage) qs.set("showOnHomepage", "true");
  put("lang", query.lang);

  const res = await fetch(`${API_BASE_URL}/api/v1/categories?${qs.toString()}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  const body = (payload ?? {}) as { data?: Category[] };
  return body.data ?? [];
}

export function submitQuickBuy(payload: QuickBuyPayload, idempotencyKey?: string): Promise<OrderSummary> {
  const extra = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined;
  return clientRequest("POST", "/api/v1/orders/quick-buy", payload, extra);
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export function loginCustomer(
  login: string,
  password: string,
  remember = false,
): Promise<CustomerAuthData> {
  return clientRequest("POST", "/api/v1/customer/auth/login", { login, password, remember });
}

/**
 * Builds the social-login start URL. Returns an absolute backend URL — the browser
 * must leave the SPA so the OAuth provider can complete the redirect round-trip.
 */
export function oauthAuthorizeUrl(provider: "google" | "facebook", returnTo?: string): string {
  const base = `${API_BASE_URL}/api/v1/customer/auth/oauth/${provider}/authorize`;
  return returnTo ? `${base}?tiep=${encodeURIComponent(returnTo)}` : base;
}

export function registerCustomer(
  email: string,
  password: string,
  firstName: string,
  lastName?: string,
  phone?: string,
): Promise<CustomerAuthData> {
  return clientRequest("POST", "/api/v1/customer/auth/register", { email, password, phone, firstName, lastName });
}

export function logoutCustomer(): Promise<void> {
  return clientRequest("POST", "/api/v1/customer/auth/logout");
}

export function resendEmailVerification(): Promise<{ sent: boolean }> {
  return clientRequest("POST", "/api/v1/customer/auth/resend-verification");
}

export function requestPasswordReset(login: string): Promise<void> {
  return clientRequest("POST", "/api/v1/customer/auth/password/forgot", { login }).then(() => undefined);
}

export function resetCustomerPassword(token: string, password: string): Promise<void> {
  return clientRequest("POST", "/api/v1/customer/auth/password/reset", { token, password }).then(() => undefined);
}

// ── Customer ──────────────────────────────────────────────────────────────────

export function fetchMe(): Promise<CustomerProfile> {
  return clientRequest("GET", "/api/v1/customer/me");
}

export function updateCustomerProfile(payload: UpdateCustomerProfilePayload): Promise<CustomerProfile> {
  return clientRequest("PATCH", "/api/v1/customer/me", payload);
}

export function fetchMyAddresses(): Promise<CustomerAddress[]> {
  return clientRequest("GET", "/api/v1/customer/addresses");
}

export function createAddress(payload: SaveAddressPayload): Promise<CustomerAddress> {
  return clientRequest("POST", "/api/v1/customer/addresses", payload);
}

export function updateAddress(id: string, payload: SaveAddressPayload): Promise<CustomerAddress> {
  return clientRequest("PATCH", `/api/v1/customer/addresses/${encodeURIComponent(id)}`, payload);
}

export function deleteAddress(id: string): Promise<void> {
  return clientRequest("DELETE", `/api/v1/customer/addresses/${encodeURIComponent(id)}`);
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function fetchMyOrders(page = 1, status?: string): Promise<{ data: OrderListItem[]; pagination: { totalPages: number; totalItems?: number } }> {
  const qs = new URLSearchParams({ page: String(page), size: "10" });
  if (status && status !== "ALL") qs.set("status", status);
  const res = await fetch(`${API_BASE_URL}/api/v1/customer/orders?${qs.toString()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await res.json().catch(() => null) as Record<string, unknown> | null;
  if (!res.ok) {
    const msg = (payload?.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return {
    data: (payload?.data as OrderListItem[] | undefined) ?? [],
    pagination: (payload?.pagination as { totalPages: number; totalItems?: number } | undefined) ?? { totalPages: 1 },
  };
}

export function cancelMyOrder(orderId: string): Promise<OrderDetail> {
  return clientRequest("PATCH", `/api/v1/customer/orders/${encodeURIComponent(orderId)}/cancel`);
}

export async function fetchMyOrder(orderId: string): Promise<OrderDetail> {
  const res = await fetch(`${API_BASE_URL}/api/v1/customer/orders/${encodeURIComponent(orderId)}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (payload === null) throw new Error("Máy chủ không trả về dữ liệu hợp lệ.");
  return (payload as { data: OrderDetail }).data ?? (payload as OrderDetail);
}

// ── Email verification ────────────────────────────────────────────────────────

export async function fetchOrderLookup(orderNumber: string, orderKey: string): Promise<OrderDetail | null> {
  const qs = new URLSearchParams({ orderNumber, orderKey });
  const res = await fetch(`${API_BASE_URL}/api/v1/orders/lookup?${qs.toString()}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return (payload as { data?: OrderDetail } | null)?.data ?? null;
}

export function verifyEmail(token: string): Promise<void> {
  return clientRequest<void>("POST", `/api/v1/customer/auth/verify-email?token=${encodeURIComponent(token)}`);
}
