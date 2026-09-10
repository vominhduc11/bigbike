import type { AnchorHTMLAttributes, ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CartProvider, useCart } from "./cart-context";

const queryClient = {
  getQueryData: vi.fn(),
  invalidateQueries: vi.fn(),
  setQueryData: vi.fn(),
};

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => queryClient }));
vi.mock("@/i18n/StorefrontLink", () => ({
  default: ({ children, href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/analytics", () => ({ trackAddToCart: vi.fn() }));
vi.mock("@/lib/api/client-api", () => ({ addCartItem: vi.fn() }));
vi.mock("@/lib/auth/auth-store", () => ({
  useAuth: () => ({ status: "authenticated" }),
}));
vi.mock("@/lib/query/hooks", () => ({
  useCartQuery: () => ({ data: { items: [] } }),
}));

function ToastHarness({ children }: { children?: ReactNode }) {
  const { showToast } = useCart();
  return (
    <>
      <button type="button" onClick={() => showToast("Sản phẩm đầu", "Nội dung đầu")}>
        Thông báo đầu
      </button>
      <button type="button" onClick={() => showToast("Sản phẩm mới", "Nội dung mới")}>
        Thông báo mới
      </button>
      {children}
    </>
  );
}

describe("CartProvider toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    queryClient.invalidateQueries.mockReset();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("chỉ giữ thông báo mới nhất và cho phép khách đóng ngay", () => {
    render(
      <CartProvider>
        <ToastHarness />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Thông báo đầu" }));
    expect(screen.getByRole("status")).toHaveTextContent("Sản phẩm đầu");

    fireEvent.click(screen.getByRole("button", { name: "Thông báo mới" }));
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Sản phẩm mới");
    expect(screen.queryByText("Sản phẩm đầu")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Common.close" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("tự đóng sau bốn giây", () => {
    render(
      <CartProvider>
        <ToastHarness />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Thông báo đầu" }));
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
