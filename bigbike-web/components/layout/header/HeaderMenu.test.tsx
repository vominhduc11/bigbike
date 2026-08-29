import { render } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string) => key,
}));
vi.mock("next/navigation", () => ({ usePathname: () => null }));
vi.mock("@/i18n/StorefrontLink", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));

import { HeaderMenu } from "./HeaderMenu";
import type { HeaderNavNode } from "@/components/layout/header-nav/shared";

const rootImage = "/media/categories/helmet-line.png";
const nestedImage = "/media/categories/fullface-photo.jpg";

const nestedCategory: HeaderNavNode = {
  id: "fullface",
  parentId: "helmets",
  label: "Mũ fullface",
  url: "/danh-muc/mu-fullface/",
  sortOrder: 2,
  openInNewTab: false,
  cssClass: null,
  iconUrl: nestedImage,
  children: [],
};

const rootCategory: HeaderNavNode = {
  id: "helmets",
  parentId: "products",
  label: "Mũ bảo hiểm",
  url: "/danh-muc/mu-bao-hiem/",
  sortOrder: 1,
  openInNewTab: false,
  cssClass: null,
  iconUrl: rootImage,
  children: [nestedCategory],
};

const missingImageCategory: HeaderNavNode = {
  id: "missing-image",
  parentId: "products",
  label: "Khuyến mãi hot",
  url: "/danh-muc/khuyen-mai-hot/",
  sortOrder: 2,
  openInNewTab: false,
  cssClass: null,
  iconUrl: null,
  children: [],
};

const productsNode: HeaderNavNode = {
  id: "products",
  parentId: null,
  label: "Tất cả sản phẩm",
  url: "/sp/",
  sortOrder: 1,
  openInNewTab: false,
  cssClass: null,
  iconUrl: "/media/categories/should-not-render.png",
  children: [rootCategory, missingImageCategory],
};

describe("HeaderMenu category icon rules", () => {
  it("uses the root category image at 24x24 on desktop and suppresses nested icons", () => {
    const { container } = render(<HeaderMenu initialNodes={[productsNode]} variant="desktop" />);

    const icons = container.querySelectorAll("[data-header-submenu-icon]");
    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveAttribute("data-header-submenu-icon-depth", "0");
    expect(icons[0]).toHaveClass("w-6", "h-6", "bg-current");
    expect(icons[0].parentElement).toHaveClass("py-2.5");
    expect(icons[0]).toHaveStyle({ maskImage: `url(${rootImage})` });
    expect(container.querySelector('[data-header-submenu-depth="1"] [data-header-submenu-icon]')).toBeNull();
    expect(container.querySelector("[data-header-menu-label]")).not.toBeNull();
    expect(container.textContent).toContain("Khuyến mãi hot");
    expect(container.querySelector('a[href="/danh-muc/khuyen-mai-hot/"]')).not.toBeNull();
  });

  it("uses the image only for level-1 mobile items and keeps missing-image links", () => {
    const { container } = render(<HeaderMenu initialNodes={[productsNode]} variant="mobile" />);

    const icons = container.querySelectorAll("[data-header-submenu-icon]");
    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveAttribute("data-header-submenu-icon-depth", "1");
    expect(icons[0]).toHaveClass("w-6", "h-6", "bg-current");
    expect(icons[0].parentElement).toHaveClass("min-h-13");
    expect(icons[0]).toHaveStyle({ WebkitMaskImage: `url(${rootImage})` });
    expect(container.querySelector('[data-header-submenu-icon-depth="0"]')).toBeNull();
    expect(container.querySelector('[data-header-submenu-icon-depth="2"]')).toBeNull();
    expect(container.textContent).toContain("Mũ fullface");
    expect(container.textContent).toContain("Khuyến mãi hot");
    expect(container.querySelector('a[href="/danh-muc/khuyen-mai-hot/"]')).not.toBeNull();
  });
});
