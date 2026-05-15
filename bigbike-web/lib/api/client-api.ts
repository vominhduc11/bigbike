import type {
  Cart,
  CheckoutOptions,
  CheckoutPayload,
  ContactPayload,
  CreateReturnPayload,
  CustomerAddress,
  CustomerAuthData,
  CustomerProfile,
  CustomerReturn,
  OrderDetail,
  OrderListItem,
  OrderSummary,
  QuickBuyPayload,
  SaveAddressPayload,
  UpdateCustomerProfilePayload,
} from "@/lib/contracts/commerce";

// Re-export for consumers that import from client-api
export type { CustomerReturn } from "@/lib/contracts/commerce";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

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

export function applyCoupon(code: string): Promise<Cart> {
  return clientRequest("POST", "/api/v1/cart/coupons", { code });
}

export function removeCoupon(code: string): Promise<Cart> {
  return clientRequest("DELETE", `/api/v1/cart/coupons/${encodeURIComponent(code)}`);
}

// ── Checkout ──────────────────────────────────────────────────────────────────

export function submitCheckout(payload: CheckoutPayload, idempotencyKey?: string): Promise<OrderSummary> {
  const extra = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined;
  return clientRequest("POST", "/api/v1/checkout", payload, extra);
}

export function fetchCheckoutOptions(): Promise<CheckoutOptions> {
  return clientRequest("GET", "/api/v1/checkout/options");
}

export function submitQuickBuy(payload: QuickBuyPayload, idempotencyKey?: string): Promise<OrderSummary> {
  const extra = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined;
  return clientRequest("POST", "/api/v1/orders/quick-buy", payload, extra);
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export function loginCustomer(login: string, password: string): Promise<CustomerAuthData> {
  return clientRequest("POST", "/api/v1/customer/auth/login", { login, password });
}

export function registerCustomer(
  email: string,
  password: string,
  firstName: string,
  lastName?: string,
): Promise<CustomerAuthData> {
  return clientRequest("POST", "/api/v1/customer/auth/register", { email, password, firstName, lastName });
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

export function submitContactForm(payload: ContactPayload): Promise<void> {
  return clientRequest<void>("POST", "/api/v1/contact", payload);
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

// ── Returns ───────────────────────────────────────────────────────────────────

export function fetchMyReturns(): Promise<CustomerReturn[]> {
  return clientRequest("GET", "/api/v1/customer/orders/returns");
}

export function fetchMyReturn(returnId: string): Promise<CustomerReturn> {
  return clientRequest("GET", `/api/v1/customer/orders/returns/${encodeURIComponent(returnId)}`);
}

export function createReturn(orderId: string, payload: CreateReturnPayload): Promise<CustomerReturn> {
  return clientRequest("POST", `/api/v1/customer/orders/${encodeURIComponent(orderId)}/returns`, payload);
}

// ── Wishlist ──────────────────────────────────────────────────────────────────

export function fetchWishlist(): Promise<string[]> {
  return clientRequest("GET", "/api/v1/customer/wishlist");
}

export function addToWishlist(productId: string): Promise<{ productId: string; added: boolean }> {
  return clientRequest("POST", "/api/v1/customer/wishlist", { productId });
}

export function removeFromWishlist(productId: string): Promise<void> {
  return clientRequest("DELETE", `/api/v1/customer/wishlist/${encodeURIComponent(productId)}`);
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
