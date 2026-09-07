import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MobileBottomNav } from "./MobileBottomNav";

const openPanel = vi.fn();
const openPanels = new Set<string>();
const navigation = vi.hoisted(() => ({ pathname: "/", locale: "vi" }));

vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => navigation.locale,
}));
vi.mock("@/i18n/StorefrontLink", () => ({
  default: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
}));
vi.mock("@/components/layout/HeaderUiContext", () => ({
  useHeaderUi: () => ({ openPanel, isPanelOpen: (p: string) => openPanels.has(p) }),
}));
vi.mock("@/lib/cart-context", () => ({ useCart: () => ({ cartCount: 0 }) }));

describe("MobileBottomNav", () => {
  beforeEach(() => {
    openPanel.mockReset();
    openPanels.clear();
    navigation.pathname = "/";
    navigation.locale = "vi";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.style.removeProperty("--bb-mobile-nav-height");
  });

  it("mở tìm kiếm và ghi nhớ nút để trả tiêu điểm khi đóng", () => {
    render(<MobileBottomNav />);

    const search = screen.getByRole("button", { name: /mobileSearchLink/ });
    expect(search).toBeVisible();

    fireEvent.click(search);
    expect(openPanel).toHaveBeenCalledWith("search", search);
  });

  it("sáng đèn tab Tìm kiếm khi panel đang mở", () => {
    openPanels.add("search");
    render(<MobileBottomNav />);

    expect(screen.getByRole("button", { name: /mobileSearchLink/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it.each([
    ["/tim-kiem", "vi"],
    ["/tim-kiem/", "vi"],
    ["/en/search/", "en"],
  ])("đánh dấu trang tìm kiếm %s mà không báo khung đang mở", (pathname, locale) => {
    navigation.pathname = pathname;
    navigation.locale = locale;
    render(<MobileBottomNav />);

    const search = screen.getByRole("button", { name: /mobileSearchLink/ });
    expect(search).toHaveAttribute("aria-current", "page");
    expect(search).toHaveAttribute("aria-pressed", "false");
  });

  it("bỏ đánh dấu Tìm kiếm khi điều hướng về Trang chủ", () => {
    navigation.pathname = "/tim-kiem/";
    const { rerender } = render(<MobileBottomNav />);
    navigation.pathname = "/";
    rerender(<MobileBottomNav />);

    expect(screen.getByRole("button", { name: /mobileSearchLink/ })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: /fallbackNav.home/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it.each(["/vi/internal/home/", "/vi/internal/home", "/en/internal/home/"])(
    "giữ dấu chọn Trang chủ khi server render đường dẫn rewrite %s",
    (pathname) => {
      navigation.pathname = pathname;
      navigation.locale = pathname.startsWith("/en/") ? "en" : "vi";
      const { rerender } = render(<MobileBottomNav />);
      const home = screen.getByRole("link", { name: /fallbackNav.home/ });
      const serverMarkup = home.outerHTML;
      expect(home).toHaveAttribute("aria-current", "page");

      navigation.pathname = navigation.locale === "en" ? "/en/" : "/";
      rerender(<MobileBottomNav />);
      expect(home.outerHTML).toBe(serverMarkup);
    },
  );

  it("cập nhật phần chừa chỗ theo chiều cao, tách safe area và dọn khi vào giỏ hàng", () => {
    let height = 60;
    let resize: () => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => ({ height }) as DOMRect,
    );
    document.documentElement.style.setProperty("--bb-mobile-nav-height", "64px");

    const { rerender } = render(<MobileBottomNav />);
    expect(document.documentElement.style.getPropertyValue("--bb-mobile-nav-height")).toBe("60px");

    screen.getByRole("navigation").style.setProperty("--bb-mobile-nav-safe-area", "34px");
    height = 124;
    act(() => resize());
    expect(document.documentElement.style.getPropertyValue("--bb-mobile-nav-height")).toBe("90px");

    navigation.pathname = "/gio-hang/";
    rerender(<MobileBottomNav />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue("--bb-mobile-nav-height")).toBe("64px");
    expect(disconnect).toHaveBeenCalled();
  });
});
