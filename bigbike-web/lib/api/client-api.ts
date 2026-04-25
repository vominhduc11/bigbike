import type {
  Cart,
  CheckoutOptions,
  CheckoutPayload,
  ContactPayload,
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
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
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
    const msg = (payload as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
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
  return clientRequest("DELETE", "/api/v1/cart");
}

export function applyCoupon(code: string): Promise<Cart> {
  return clientRequest("POST", "/api/v1/cart/coupons", { code });
}

export function removeCoupon(code: string): Promise<Cart> {
  return clientRequest("DELETE", `/api/v1/cart/coupons/${encodeURIComponent(code)}`);
}

// ── Checkout ──────────────────────────────────────────────────────────────────

export function submitCheckout(payload: CheckoutPayload): Promise<OrderSummary> {
  return clientRequest("POST", "/api/v1/checkout", payload);
}

export function fetchCheckoutOptions(): Promise<CheckoutOptions> {
  return clientRequest("GET", "/api/v1/checkout/options");
}

export function submitQuickBuy(payload: QuickBuyPayload): Promise<OrderSummary> {
  return clientRequest("POST", "/api/v1/orders/quick-buy", payload);
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export function loginCustomer(login: string, password: string): Promise<CustomerAuthData> {
  return clientRequest("POST", "/api/v1/customer/auth/login", { login, password });
}

export function registerCustomer(
  email: string,
  phone: string,
  password: string,
  displayName: string,
): Promise<CustomerAuthData> {
  return clientRequest("POST", "/api/v1/customer/auth/register", { email, phone, password, displayName });
}

export function logoutCustomer(): Promise<void> {
  return clientRequest("POST", "/api/v1/customer/auth/logout");
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

export async function fetchMyOrders(page = 1): Promise<{ data: OrderListItem[]; pagination: { totalPages: number } }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/customer/orders?page=${page}&size=10`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (payload as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return {
    data: (payload as { data: OrderListItem[] }).data ?? [],
    pagination: (payload as { pagination: { totalPages: number } }).pagination ?? { totalPages: 1 },
  };
}

export async function fetchMyOrder(orderId: string): Promise<OrderDetail> {
  const res = await fetch(`${API_BASE_URL}/api/v1/customer/orders/${encodeURIComponent(orderId)}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (payload as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return (payload as { data: OrderDetail }).data;
}
