import type {
  Cart,
  CheckoutPayload,
  CustomerAddress,
  CustomerAuthData,
  CustomerProfile,
  OrderDetail,
  OrderListItem,
  OrderSummary,
  SaveAddressPayload,
  UpdateCustomerProfilePayload,
} from "@/lib/contracts/commerce";
import type { Article, Brand, CatalogFacets, Category, Product, PublicMenu } from "@/lib/contracts/public";
import { withFlatHighlights } from "@/lib/contracts/public";
import { env } from "@/env";

const API_BASE_URL = env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

function invalidPayloadMessage(): string {
  if (typeof window !== "undefined" && /^\/en(?:\/|$)/.test(window.location.pathname)) {
    return "The server did not return valid data.";
  }
  return "Máy chủ không trả về dữ liệu hợp lệ.";
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(`API request failed with status ${status}`);
    this.name = "ApiClientError";
  }
}

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
  signal?: AbortSignal,
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
    signal,
  });

  if (res.status === 204) return undefined as T;
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const apiError = (payload as {
      error?: { code?: string; fieldErrors?: Record<string, string> };
    } | null)?.error;
    throw new ApiClientError(res.status, apiError?.code, apiError?.fieldErrors);
  }
  if (payload === null) throw new Error(invalidPayloadMessage());
  return (payload as { data: T }).data ?? (payload as T);
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

function payloadData(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as Record<string, unknown>).data;
  }
  return payload;
}

function payloadPagination<T>(payload: unknown): T | null {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (record.pagination) {
      return record.pagination as T;
    }
    if (record.data && typeof record.data === "object" && "pagination" in record.data) {
      return (record.data as Record<string, unknown>).pagination as T;
    }
  }
  return null;
}

// ── Cart ─────────────────────────────────────────────────────────────────────

export type ChatContact = {
  hotline?: string | null;
  zaloUrl?: string | null;
  messengerUrl?: string | null;
  zaloDisplay?: string | null;
  messengerDisplay?: string | null;
};

export type ChatAvailability = {
  mode: "AI" | "CONTACT";
  reason?: string | null;
  greeting?: string | null;
  quickPrompts: string[];
  maxTurns: number;
  contacts: ChatContact;
};

export type ChatActionType = "LOGIN" | "ORDER_HISTORY" | "ORDER_LOOKUP";

export type ChatAction = {
  type: ChatActionType;
};

export type ChatProductCard = {
  slug: string;
  name: string;
  imageUrl?: string | null;
  retailPrice?: number | null;
  salePrice?: number | null;
  currency?: string | null;
  stockState?: string | null;
};

export type ChatMessageResult = {
  conversationId?: string | null;
  mode: "AI" | "CONTACT";
  reason?: string | null;
  answer?: string | null;
  turnCount: number;
  maxTurns: number;
  remainingTurns: number;
  products: ChatProductCard[];
  handoffRecommended: boolean;
  leadPrompt: boolean;
  actions: ChatAction[];
  contacts: ChatContact;
};

const CHAT_ACTION_TYPES = new Set<ChatActionType>(["LOGIN", "ORDER_HISTORY", "ORDER_LOOKUP"]);
const CHAT_FORBIDDEN_TEXT = /(?:\b(?:api|endpoint|database|session|quota|gemini|json|tool|sql|function\s*call|functioncall|stack\s*trace|exception|error(?:\s*(?:code|id|message))?)\b|\berror\s*[:#])/i;
const CHAT_RAW_CODES = /\b(?:CANCELLED|COMPLETED|PENDING|PROCESSING|IN_STOCK|OUT_OF_STOCK|AI_UNAVAILABLE|CONTACT_FALLBACK|NO_MATCH_IN_REQUESTED_PRICE_RANGE|SEARCH_WAS_BROADENED)\b/;
const CHAT_RAW_CURRENCY = /(?:\b\d[\d.,]*\s*(?:VND|VNĐ)\b|\b(?:VND|VNĐ)\b|\b\d[\d.,]*[.,]\d{1,2}\s*₫)/i;
const CHAT_URL = /(?:https?:\/\/|www\.|\/(?:product|san-pham)\/)/i;
const CHAT_VIETNAMESE_TEXT = /[à-ỹÀ-ỸđĐ]/;

function isSafeChatDisplayText(value: unknown, lang: "vi" | "en"): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  const text = value.trim();
  if (CHAT_FORBIDDEN_TEXT.test(text)
    || CHAT_RAW_CODES.test(text)
    || CHAT_RAW_CURRENCY.test(text)
    || CHAT_URL.test(text)) return false;
  return lang !== "en" || !CHAT_VIETNAMESE_TEXT.test(text);
}

function normalizeChatContacts(value: unknown): ChatContact {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const text = (key: string) => typeof source[key] === "string" ? source[key] as string : undefined;
  return {
    hotline: text("hotline"),
    zaloUrl: text("zaloUrl"),
    messengerUrl: text("messengerUrl"),
    zaloDisplay: text("zaloDisplay"),
    messengerDisplay: text("messengerDisplay"),
  };
}

function normalizeChatActions(value: unknown): ChatAction[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => item && typeof item === "object" ? (item as Record<string, unknown>).type : null)
    .filter((type): type is ChatActionType => typeof type === "string" && CHAT_ACTION_TYPES.has(type as ChatActionType))
    .map((type) => ({ type }))
    .slice(0, 2);
}

function normalizeChatProducts(value: unknown): { products: ChatProductCard[]; unsafe: boolean } {
  if (value == null) return { products: [], unsafe: false };
  if (!Array.isArray(value)) return { products: [], unsafe: true };

  const asNumber = (raw: unknown): number | null => {
    const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };
  const products: ChatProductCard[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const source = item as Record<string, unknown>;
    const retailPrice = asNumber(source.retailPrice);
    const saleProvided = source.salePrice !== null && source.salePrice !== undefined && source.salePrice !== "";
    const salePrice = saleProvided ? asNumber(source.salePrice) : null;
    const slug = typeof source.slug === "string" ? source.slug.trim() : "";
    const name = typeof source.name === "string" ? source.name.trim() : "";
    const valid = slug.length > 0
      && name.length > 0
      && retailPrice !== null && retailPrice > 0
      && source.currency === "VND"
      && source.stockState === "IN_STOCK"
      && (!saleProvided || (salePrice !== null && salePrice > 0 && salePrice < retailPrice));
    if (!valid) continue;
    products.push({
      slug,
      name,
      imageUrl: typeof source.imageUrl === "string" ? source.imageUrl : null,
      retailPrice,
      salePrice,
      currency: "VND",
      stockState: "IN_STOCK",
    });
  }
  return { products: products.slice(0, 3), unsafe: false };
}

function normalizeChatMessageResult(value: unknown, lang: "vi" | "en"): ChatMessageResult {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const answer = typeof source.answer === "string" ? source.answer.trim() : "";
  const safeAnswer = Boolean(answer && isSafeChatDisplayText(answer, lang));
  const normalizedProducts = normalizeChatProducts(source.products);
  const unsafe = Boolean(answer && !safeAnswer) || normalizedProducts.unsafe;
  const mode = source.mode === "AI" && safeAnswer && !unsafe ? "AI" : "CONTACT";
  return {
    conversationId: typeof source.conversationId === "string" ? source.conversationId : null,
    mode,
    reason: mode,
    answer: unsafe ? null : answer || null,
    turnCount: typeof source.turnCount === "number" ? source.turnCount : 0,
    maxTurns: typeof source.maxTurns === "number" ? source.maxTurns : 12,
    remainingTurns: typeof source.remainingTurns === "number" ? source.remainingTurns : 0,
    products: unsafe ? [] : normalizedProducts.products,
    handoffRecommended: mode === "CONTACT" || source.handoffRecommended === true,
    leadPrompt: !unsafe && source.leadPrompt === true,
    actions: unsafe || !answer ? [] : normalizeChatActions(source.actions),
    contacts: normalizeChatContacts(source.contacts),
  };
}

export function fetchChatAvailability(lang: "vi" | "en"): Promise<ChatAvailability> {
  return clientRequest<ChatAvailability>("GET", `/api/v1/chat/availability?lang=${lang}`).then((value) => {
    const source = value && typeof value === "object" ? value : {} as ChatAvailability;
    const quickPrompts = Array.isArray(source.quickPrompts)
      ? source.quickPrompts.filter((prompt): prompt is string => isSafeChatDisplayText(prompt, lang)).slice(0, 4)
      : [];
    return {
      ...source,
      mode: source.mode === "AI" ? "AI" : "CONTACT",
      greeting: isSafeChatDisplayText(source.greeting, lang) ? source.greeting : null,
      quickPrompts,
      maxTurns: Number.isFinite(source.maxTurns) ? source.maxTurns : 12,
      contacts: normalizeChatContacts(source.contacts),
    };
  });
}

export function sendChatMessage(
  message: string,
  lang: "vi" | "en",
  conversationId?: string,
  signal?: AbortSignal,
): Promise<ChatMessageResult> {
  return clientRequest<unknown>("POST", "/api/v1/chat/messages", {
    conversationId: conversationId || null,
    message,
    lang,
  }, undefined, signal).then((value) => normalizeChatMessageResult(value, lang));
}

export function captureChatLead(input: {
  conversationId: string;
  name?: string;
  phone?: string;
  note?: string;
  contactSource?: "FORM" | "ACCOUNT";
}): Promise<{ captured: boolean }> {
  return clientRequest("POST", "/api/v1/chat/leads", { ...input, consent: true });
}

export function declineChatLead(conversationId: string): Promise<{ declined: boolean }> {
  return clientRequest("POST", "/api/v1/chat/leads/decline", { conversationId });
}

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
  return asArray<PublicSetting>(payloadData(payload));
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
 * Client-side product detail fetch used by the content localizer to refetch
 * the full payload in English after a locale switch.
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
  brand?: string | string[];
  q?: string;
  filterColor?: string | string[];
  filterFinish?: string | string[];
  filterGender?: string;
  sizeFilter?: string | string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  homepageBlock?: "NONE" | "FEATURED_GRID";
  lang?: string;
};

export type PublicProductListResult = {
  data: Product[];
  pagination: { page: number; totalPages: number; totalItems?: number | null } | null;
};

/** Append a query param only when the value is meaningful (skips undefined/null/empty string). */
function appendParam(qs: URLSearchParams, key: string, value: string | string[] | number | boolean | undefined) {
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
  signal?: AbortSignal,
): Promise<PublicProductListResult> {
  const qs = new URLSearchParams();
  const put = (k: string, v: string | string[] | number | boolean | undefined) => {
    if (Array.isArray(v)) {
      v.forEach((item) => {
        if (item !== "") qs.append(k, item);
      });
    } else {
      appendParam(qs, k, v);
    }
  };
  put("page", query.page);
  put("size", query.size);
  put("sort", query.sort ?? "createdAt:desc");
  put("category", query.category);
  put("pwb-brand", query.brand);
  put("q", query.q);
  put("filter_color", query.filterColor);
  put("filter_finish", query.filterFinish);
  put("filter_gender", query.filterGender);
  put("kich-co", query.sizeFilter);
  put("min_price", query.minPrice);
  put("max_price", query.maxPrice);
  put("in_stock", query.inStock ? true : undefined);
  put("homepage_block", query.homepageBlock);
  put("lang", query.lang);

  const res = await fetch(`${API_BASE_URL}/api/v1/products?${qs.toString()}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
    signal,
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return {
    data: asArray<Product>(payloadData(payload)),
    pagination: payloadPagination<PublicProductListResult["pagination"]>(payload),
  };
}

export type PublicCatalogFacetsQuery = {
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
  lang?: string;
};

/** Refetches facet counts for the current catalog context; price bounds are omitted so the axis stays stable. */
export async function fetchPublicCatalogFacets(
  query: PublicCatalogFacetsQuery,
  signal?: AbortSignal,
): Promise<{ data: CatalogFacets }> {
  const qs = new URLSearchParams();
  const put = (key: string, value: string | string[] | number | boolean | undefined) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) qs.append(key, item);
      });
    } else if (value !== undefined && value !== "") {
      qs.set(key, String(value));
    }
  };
  put("category", query.category);
  put("pwb-brand", query.brand);
  put("q", query.q);
  put("filter_color", query.filterColor);
  put("filter_finish", query.filterFinish);
  put("filter_gender", query.filterGender);
  put("kich-co", query.sizeFilter);
  put("min_price", query.minPrice);
  put("max_price", query.maxPrice);
  put("in_stock", query.inStock ? true : undefined);
  put("lang", query.lang);

  const payload = await clientRequest<unknown>("GET", `/api/v1/catalog/facets?${qs.toString()}`, undefined, undefined, signal);
  const data = payloadData(payload) as CatalogFacets;
  return { data };
}

 type PublicArticleListQuery = {
  page?: number;
  size?: number;
  q?: string;
  lang?: string;
};

export type PublicArticleListResult = {
  data: Article[];
  pagination: { page: number; totalPages: number; totalItems?: number | null } | null;
};

/** Client-side article list fetch — lưới tin tức CSR (tìm/phân trang). */
export async function fetchPublicArticleList(
  query: PublicArticleListQuery,
): Promise<PublicArticleListResult> {
  const qs = new URLSearchParams();
  const put = (k: string, v: string | number | undefined) => appendParam(qs, k, v);
  put("page", query.page);
  put("size", query.size);
  put("sort", "publishedAt:desc");
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
  return {
    data: asArray<Article>(payloadData(payload)),
    pagination: payloadPagination<PublicArticleListResult["pagination"]>(payload),
  };
}

export type PublicBrandListResult = {
  data: Brand[];
  pagination: { page: number; totalPages: number; totalItems?: number | null } | null;
};

/** Client-side brand list fetch — lưới thương hiệu CSR (phân trang/sắp xếp). */
export async function fetchPublicBrandList(
  query: { page?: number; size?: number; sort?: string; showOnHomepage?: boolean; lang?: string },
): Promise<PublicBrandListResult> {
  const qs = new URLSearchParams();
  const put = (k: string, v: string | number | undefined) => appendParam(qs, k, v);
  put("page", query.page);
  put("size", query.size);
  put("sort", query.sort ?? "name:asc");
  if (query.showOnHomepage) qs.set("showOnHomepage", "true");
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
  return {
    data: asArray<Brand>(payloadData(payload)),
    pagination: payloadPagination<PublicBrandListResult["pagination"]>(payload),
  };
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
  return asArray<Category>(payloadData(payload));
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

// Avatar upload/remove bypass clientRequest (JSON-only) — multipart body for upload,
// no body for delete — but reuse the same CSRF/credentials/error-unwrap conventions.
async function unwrapAvatarResponse(res: Response): Promise<CustomerProfile> {
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (payload === null) throw new Error(invalidPayloadMessage());
  return (payload as { data: CustomerProfile }).data;
}

export async function uploadCustomerAvatar(file: File): Promise<CustomerProfile> {
  const form = new FormData();
  form.set("file", file);
  const headers: Record<string, string> = { Accept: "application/json" };
  const csrf = getCsrfToken();
  if (csrf) headers["X-CSRF-Token"] = csrf;
  const res = await fetch(`${API_BASE_URL}/api/v1/customer/me/avatar`, {
    method: "POST",
    credentials: "include",
    headers,
    body: form,
  });
  return unwrapAvatarResponse(res);
}

export async function removeCustomerAvatar(): Promise<CustomerProfile> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const csrf = getCsrfToken();
  if (csrf) headers["X-CSRF-Token"] = csrf;
  const res = await fetch(`${API_BASE_URL}/api/v1/customer/me/avatar`, {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  return unwrapAvatarResponse(res);
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
  if (payload === null) throw new Error(invalidPayloadMessage());
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
