import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MobileBottomNav } from "./MobileBottomNav";

const openPanel = vi.fn();
const openPanels = new Set<string>();

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "vi",
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
  });

  // Chốt với chủ shop 2026-09-07: thanh dưới chỉ có Trang chủ / Giỏ hàng / Tài khoản,
  // khách trên điện thoại không có lối vào Tìm kiếm nào ngoài kính lúp ở đầu trang.
  it("có tab Tìm kiếm và mở đúng panel tìm kiếm", () => {
    render(<MobileBottomNav />);

    const search = screen.getByRole("button", { name: /mobileSearchLink/ });
    expect(search).toBeVisible();

    fireEvent.click(search);
    expect(openPanel).toHaveBeenCalledWith("search");
  });

  it("sáng đèn tab Tìm kiếm khi panel đang mở", () => {
    openPanels.add("search");
    render(<MobileBottomNav />);

    expect(screen.getByRole("button", { name: /mobileSearchLink/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
