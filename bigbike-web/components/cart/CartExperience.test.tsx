import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CartClient } from "./CartClient";
import { MobileCartSheet } from "@/components/layout/MobileCartSheet";
import { HeaderUiProvider, useHeaderUi } from "@/components/layout/HeaderUiContext";
import { fetchCart, updateCartItem, removeCartItem } from "@/lib/api/client-api";
import { queryKeys } from "@/lib/query/keys";
import type { Cart } from "@/lib/contracts/commerce";
import viMessages from "@/messages/vi.json";
import enMessages from "@/messages/en.json";

let locale = "vi";
let pathname = "/";
let desktop = false;
let desktopListener: (() => void) | undefined;

vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("next-intl", () => ({
  useLocale: () => locale,
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    const messages = (locale === "vi" ? viMessages : enMessages) as Record<
      string,
      Record<string, unknown>
    >;
    const template = messages[namespace]?.[key];
    return (typeof template === "string" ? template : key).replace(
      /\{(\w+)\}/g,
      (_, name: string) => String(values?.[name] ?? ""),
    );
  },
}));
vi.mock("@/lib/api/client-api", () => ({
  fetchCart: vi.fn(),
  updateCartItem: vi.fn(),
  removeCartItem: vi.fn(),
}));
vi.mock("@/lib/cart-context", () => ({ useCart: () => ({ refreshCount: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({ trackViewCart: vi.fn(), trackRemoveFromCart: vi.fn() }));
vi.mock("@/lib/observability/storefront-error", () => ({ reportStorefrontFailure: vi.fn() }));

function cartWith(quantity = 1, available = true): Cart {
  return {
    id: "cart-review",
    status: "ACTIVE",
    currency: "VND",
    items: [
      {
        id: "line-1",
        productId: "product-1",
        productVariantId: "variant-1",
        sku: "INTERNAL-SKU",
        productName: "Áo giáp thử nghiệm",
        variantName: "Đen - M",
        quantity,
        unitPrice: 100000,
        lineSubtotal: quantity * 100000,
        lineDiscount: 0,
        lineTotal: quantity * 100000,
        available,
      },
    ],
    totals: {
      subtotalAmount: quantity * 100000,
      discountAmount: 0,
      shippingAmount: 0,
      feeAmount: 0,
      totalAmount: quantity * 100000,
    },
  };
}

function OpenCart() {
  const { openPanel } = useHeaderUi();
  return <button onClick={(event) => openPanel("cart", event.currentTarget)}>Mở giỏ</button>;
}

function setup({
  initial = cartWith(),
  sheet = true,
}: { initial?: Cart | null; sheet?: boolean } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (initial) client.setQueryData(queryKeys.cart(), initial);
  const content = (
    <QueryClientProvider client={client}>
      <HeaderUiProvider>
        {sheet ? (
          <>
            <OpenCart />
            <MobileCartSheet />
          </>
        ) : (
          <CartClient />
        )}
      </HeaderUiProvider>
    </QueryClientProvider>
  );
  const view = render(content);
  return { client, ...view, rerenderView: () => view.rerender(content) };
}

beforeEach(() => {
  vi.clearAllMocks();
  locale = "vi";
  pathname = "/";
  desktop = false;
  desktopListener = undefined;
  vi.mocked(fetchCart).mockResolvedValue(cartWith());
  vi.mocked(updateCartItem).mockResolvedValue(cartWith(2));
  vi.mocked(removeCartItem).mockResolvedValue({ ...cartWith(), items: [] });
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return desktop;
    },
    addEventListener: (_event: string, listener: () => void) => {
      desktopListener = listener;
    },
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => onlineManager.setOnline(true));

async function openCart() {
  fireEvent.click(screen.getByRole("button", { name: "Mở giỏ" }));
  await waitFor(() => expect(fetchCart).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Tiếp tục đặt hàng" })).not.toBeInTheDocument(),
  );
}

describe("Mobile cart quick view", () => {
  it("fails an offline edit visibly instead of silently queuing it for reconnection", async () => {
    setup();
    await openCart();
    onlineManager.setOnline(false);
    vi.mocked(updateCartItem).mockRejectedValue(new Error("Offline"));
    fireEvent.click(screen.getByRole("button", { name: "Tăng số lượng Áo giáp thử nghiệm" }));
    await screen.findByRole("alert");
    expect(updateCartItem).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Tăng số lượng Áo giáp thử nghiệm" })).toBeEnabled();
    expect(screen.queryByText("Đang cập nhật…")).not.toBeInTheDocument();
  });

  it("shares confirmed quantities/totals, locks pending checkout and restores trigger focus", async () => {
    let resolveUpdate!: (cart: Cart) => void;
    vi.mocked(updateCartItem).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    const { client } = setup();
    await openCart();
    expect(screen.getByText("Miễn phí vận chuyển toàn quốc")).toBeVisible();
    expect(screen.queryByText("INTERNAL-SKU")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tiếp tục đặt hàng" })).toHaveAttribute(
      "href",
      "/dat-hang",
    );
    fireEvent.click(screen.getByRole("button", { name: "Tăng số lượng Áo giáp thử nghiệm" }));
    expect(screen.getByRole("button", { name: "Đang cập nhật…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Xóa Áo giáp thử nghiệm" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Tiếp tục đặt hàng" })).not.toBeInTheDocument();
    await waitFor(() => expect(updateCartItem).toHaveBeenCalledTimes(1));
    await act(async () => resolveUpdate(cartWith(2)));
    expect(client.getQueryData<Cart>(queryKeys.cart())?.items[0].quantity).toBe(2);
    expect(screen.getAllByText("200.000 đ")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Mở giỏ" })).toHaveFocus());
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps products and confirmed quantities after a failed edit and recovers with retry", async () => {
    vi.mocked(updateCartItem).mockRejectedValue(new Error("PRIVATE SQL CONNECTION ERROR"));
    setup();
    await openCart();
    fireEvent.click(screen.getByRole("button", { name: "Tăng số lượng Áo giáp thử nghiệm" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("heading", { name: "Áo giáp thử nghiệm" })).toBeVisible();
    expect(screen.getAllByText("100.000 đ")).toHaveLength(2);
    expect(screen.queryByText(/PRIVATE SQL/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tiếp tục đặt hàng" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Tiếp tục đặt hàng" })).toBeVisible();
  });

  it("offers recovery from a failed initial load without exposing raw errors", async () => {
    vi.mocked(fetchCart).mockRejectedValue(new Error("PRIVATE SQL CONNECTION ERROR"));
    setup({ initial: null });
    fireEvent.click(screen.getByRole("button", { name: "Mở giỏ" }));
    await screen.findByText(viMessages.CartMini.loadFailed);
    expect(screen.queryByText(/PRIVATE SQL/)).not.toBeInTheDocument();
    vi.mocked(fetchCart).mockResolvedValue(cartWith());
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByRole("link", { name: "Tiếp tục đặt hàng" });
  });

  it("keeps cached items visible after a refresh failure", async () => {
    vi.mocked(fetchCart).mockRejectedValue(new Error("Network disconnected"));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Mở giỏ" }));
    await screen.findByText(viMessages.CartMini.loadFailed);
    expect(screen.getByRole("heading", { name: "Áo giáp thử nghiệm" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Tiếp tục đặt hàng" })).toBeDisabled();
  });

  it("allows removing an unavailable product but blocks quantity changes and checkout", async () => {
    vi.mocked(fetchCart).mockResolvedValue(cartWith(1, false));
    setup({ initial: cartWith(1, false) });
    fireEvent.click(screen.getByRole("button", { name: "Mở giỏ" }));
    await waitFor(() => expect(fetchCart).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Tiếp tục đặt hàng" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tăng số lượng Áo giáp thử nghiệm" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Xóa Áo giáp thử nghiệm" }));
    await screen.findByText("Giỏ hàng trống");
    expect(removeCartItem).toHaveBeenCalledWith("line-1");
    expect(screen.getByRole("link", { name: "Mua sắm ngay" })).toHaveAttribute("href", "/sp");
  });

  it("closes and unlocks the page when switching from mobile to desktop", async () => {
    setup();
    await openCart();
    expect(screen.getByRole("dialog")).toBeVisible();
    act(() => {
      desktop = true;
      desktopListener?.();
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe("");
  });

  it("uses English copy and localized destinations", async () => {
    locale = "en";
    setup();
    await openCart();
    expect(await screen.findByRole("link", { name: "Continue to checkout" })).toHaveAttribute(
      "href",
      "/en/order",
    );
    expect(screen.getByRole("link", { name: "View cart" })).toHaveAttribute("href", "/en/cart");
  });
});

describe("Full cart page", () => {
  it("blocks checkout while a mutation started in the quick view is still pending", async () => {
    const { client } = setup({ sheet: false });
    let finish!: (cart: Cart) => void;
    const mutation = client.getMutationCache().build(client, {
      mutationKey: queryKeys.cart(),
      mutationFn: () =>
        new Promise<Cart>((resolve) => {
          finish = resolve;
        }),
    });
    let result!: Promise<Cart>;
    act(() => {
      result = mutation.execute(undefined);
    });
    await waitFor(() =>
      expect(screen.queryAllByRole("link", { name: "Tiếp tục đặt hàng" })).toHaveLength(0),
    );
    expect(screen.getByRole("spinbutton")).toBeDisabled();
    await act(async () => {
      finish(cartWith(2));
      await result;
    });
    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: "Tiếp tục đặt hàng" })).toHaveLength(2),
    );
  });

  it("rolls back a failed quantity update and allows retry", async () => {
    vi.mocked(updateCartItem).mockRejectedValue(new Error("Offline"));
    setup({ sheet: false });
    fireEvent.click(screen.getByRole("button", { name: "Tăng số lượng Áo giáp thử nghiệm" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("spinbutton")).toHaveValue(1);
    expect(screen.queryByRole("link", { name: "Tiếp tục đặt hàng" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("updates quantity fields when another view refreshes the same cart ID", async () => {
    const { client } = setup({ sheet: false });
    act(() => {
      client.setQueryData(queryKeys.cart(), cartWith(3));
    });
    await waitFor(() => expect(screen.getByRole("spinbutton")).toHaveValue(3));
  });

  it("prevents checkout for unconfirmed typed quantities and locks simultaneous mutations", async () => {
    let resolveUpdate!: (cart: Cart) => void;
    vi.mocked(updateCartItem).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    setup({ sheet: false });
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "2" } });
    expect(screen.queryByRole("link", { name: "Tiếp tục đặt hàng" })).not.toBeInTheDocument();
    fireEvent.blur(screen.getByRole("spinbutton"));
    fireEvent.click(screen.getByRole("button", { name: "Tăng số lượng Áo giáp thử nghiệm" }));
    fireEvent.click(screen.getByRole("button", { name: "Xóa sản phẩm" }));
    await waitFor(() => expect(updateCartItem).toHaveBeenCalledTimes(1));
    expect(removeCartItem).not.toHaveBeenCalled();
    await act(async () => resolveUpdate(cartWith(2)));
    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: "Tiếp tục đặt hàng" })).toHaveLength(2),
    );
  });
});
