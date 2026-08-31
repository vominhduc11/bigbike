import { render } from "@testing-library/react";
import { vi } from "vitest";

const localeState = vi.hoisted(() => ({ value: "vi" }));

vi.mock("next-intl", () => ({
  useLocale: () => localeState.value,
  useTranslations: () => (key: string) => key,
}));
vi.mock("next/navigation", () => ({ usePathname: () => null }));
vi.mock("@/i18n/StorefrontLink", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
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

const sampleMenuLabels = {
  vi: [
    { label: "Khuyến mãi hot", children: [] },
    {
      label: "Mũ bảo hiểm",
      children: ["dual sport", "fullface", "lật hàm, tháo hàm", "3-4 và nửa đầu"],
    },
    { label: "Áo quần moto - phượt", children: ["touring", "mùa hè", "adventure"] },
    { label: "Găng tay moto xe máy", children: ["touring", "mùa hè"] },
    { label: "Giày bảo hộ moto", children: ["mùa hè", "touring"] },
    {
      label: "Balô - túi đeo - túi treo xe",
      children: ["balo phượt", "túi đeo hông - đeo đùi", "túi treo xe máy và túi hít bình xăng"],
    },
    { label: "Giáp bảo hộ tay chân", children: [] },
    { label: "Tai nghe bluetooth mũ bảo hiểm", children: [] },
    {
      label: "Giá đỡ điện thoại và phụ kiện camera hành trình",
      children: ["giá đỡ điện thoại", "phụ kiện camera hành trình", "phụ kiện cho xe"],
    },
    {
      label: "Đồ lót giáp, đồ mưa và phụ kiện moto",
      children: ["áo mưa và đồ đi mưa", "đồ lót và khăn trùm đầu", "phụ kiện khác"],
    },
  ],
  en: [
    { label: "Hot promotions", children: [] },
    {
      label: "Helmets",
      children: ["dual sport", "full-face", "flip-up and modular", "three-quarter and half-face"],
    },
    { label: "Motorcycle and touring clothing", children: ["touring", "summer", "adventure"] },
    { label: "Motorcycle gloves", children: ["touring", "summer"] },
    { label: "Motorcycle protective boots", children: ["summer", "touring"] },
    {
      label: "Backpacks - hip bags - motorcycle tank bags",
      children: ["touring backpacks", "hip bags - thigh bags", "motorcycle tank bags"],
    },
    { label: "Arm and leg protection", children: [] },
    { label: "Bluetooth helmet headsets", children: [] },
    {
      label: "Phone holders and action camera accessories",
      children: ["phone holders", "action camera accessories", "motorcycle accessories"],
    },
    {
      label: "Base layers, rainwear and motorcycle accessories",
      children: ["raincoats and rain gear", "base layers and balaclavas", "other accessories"],
    },
  ],
} as const;

function createSampleProductsNode(locale: keyof typeof sampleMenuLabels): HeaderNavNode {
  const categories = sampleMenuLabels[locale].map((category, categoryIndex) => {
    const id = `${locale}-category-${categoryIndex}`;
    return {
      id,
      parentId: `${locale}-products`,
      label: category.label,
      url: `/sample/${locale}/category-${categoryIndex}`,
      sortOrder: categoryIndex + 1,
      openInNewTab: false,
      cssClass: null,
      iconUrl: `/sample/${locale}/category-${categoryIndex}.png`,
      children: category.children.map((label, childIndex) => ({
        id: `${id}-child-${childIndex}`,
        parentId: id,
        label,
        url: `/sample/${locale}/category-${categoryIndex}/${childIndex}`,
        sortOrder: childIndex + 1,
        openInNewTab: false,
        cssClass: null,
        iconUrl: null,
        children: [],
      })),
    };
  });

  return {
    id: `${locale}-products`,
    parentId: null,
    label: locale === "vi" ? "Tất cả sản phẩm" : "All products",
    url: locale === "vi" ? "/sp/" : "/products/",
    sortOrder: 1,
    openInNewTab: false,
    cssClass: null,
    iconUrl: null,
    children: categories,
  };
}

describe("HeaderMenu category icon rules", () => {
  it("uses the root category image at 24x24 on desktop and suppresses nested icons", () => {
    const { container } = render(<HeaderMenu initialNodes={[productsNode]} variant="desktop" />);

    const icons = container.querySelectorAll("[data-header-submenu-icon]");
    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveAttribute("data-header-submenu-icon-depth", "0");
    expect(icons[0]).toHaveClass("w-6", "h-6", "bg-current");
    expect(icons[0].parentElement).toHaveClass("h-11");
    expect(icons[0]).toHaveStyle({ maskImage: `url(${rootImage})` });
    expect(
      container.querySelector('[data-header-submenu-depth="1"] [data-header-submenu-icon]'),
    ).toBeNull();
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

describe("HeaderMenu desktop submenu sizing and accessibility", () => {
  afterEach(() => {
    localeState.value = "vi";
  });

  for (const locale of ["vi", "en"] as const) {
    it(`keeps every ${locale} desktop sample row fixed and exposes the full label`, () => {
      localeState.value = locale;
      const { container } = render(
        <HeaderMenu initialNodes={[createSampleProductsNode(locale)]} variant="desktop" />,
      );

      const rootRows = container.querySelectorAll('[data-header-submenu-depth="0"] > li');
      const childRows = container.querySelectorAll('[data-header-submenu-depth="1"] > li');
      const desktopLinks = container.querySelectorAll(
        "[data-header-desktop-menu] [data-header-submenu] a",
      );

      expect(rootRows).toHaveLength(10);
      expect(childRows).toHaveLength(20);
      expect(desktopLinks).toHaveLength(30);

      for (const link of desktopLinks) {
        const label = link.querySelector("[data-header-menu-label]");
        expect(link).toHaveClass("h-11");
        expect(label).toHaveClass("min-w-0", "flex-1", "truncate");
        expect(label).not.toBeNull();
        const fullLabel = label?.textContent?.trim() ?? "";
        expect(link).toHaveAttribute("title", fullLabel);
        expect(link).toHaveAccessibleName(fullLabel);
      }
    });
  }

  it("keeps mobile sample labels wrapping instead of truncating", () => {
    const { container } = render(
      <HeaderMenu initialNodes={[createSampleProductsNode("vi")]} variant="mobile" />,
    );

    const mobileLabels = container.querySelectorAll("[data-header-menu-label]");
    expect(mobileLabels.length).toBeGreaterThan(0);
    for (const label of mobileLabels) {
      expect(label).toHaveClass("break-words");
      expect(label.closest("a")).toHaveClass("whitespace-normal");
      expect(label).not.toHaveClass("truncate");
    }
  });
});
