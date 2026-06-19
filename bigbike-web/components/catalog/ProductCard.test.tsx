import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/contracts/public";
import { ProductCard } from "./ProductCard";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    return t;
  },
  useLocale: () => "vi",
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: Record<string, unknown>) => <img alt="" data-testid="next-image" src={String(props.src ?? "")} />,
}));

vi.mock("@/components/catalog/ProductCardAddBar", () => ({
  ProductCardAddBar: () => <div data-testid="add-bar" />,
}));

vi.mock("@/components/ui/MediaImage", () => ({
  MediaImage: () => <div data-testid="media-image" />,
}));

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    slug: "mu-bao-hiem-test",
    name: "Mũ bảo hiểm test",
    category: { id: "c1", slug: "mu-bao-hiem", name: "Mũ bảo hiểm" },
    price: { retailPrice: 1000000, currency: "VND" },
    stockState: "IN_STOCK",
    publishStatus: "PUBLISHED",
    homepageBlock: "NONE",
    createdAt: "",
    updatedAt: "",
    ...overrides,
  } as Product;
}

function stars(container: HTMLElement) {
  return container.querySelector('[aria-label$=" sao"]');
}

const VARIANTS = ["featured", "archive", "compact"] as const;

describe.each(VARIANTS)("ProductCard (variant %s) — gate sao theo REVIEW_RULE_003", (variant) => {
  const cardVariant = variant === "compact" ? undefined : variant;

  it("ratingCount >= 1 → hiện 5 sao tô đúng trung bình cộng", () => {
    const { container } = render(
      <ProductCard product={makeProduct({ rating: 4.0, ratingCount: 3 })} variant={cardVariant} />,
    );
    const el = stars(container);
    expect(el).not.toBeNull();
    expect(el!.getAttribute("aria-label")).toBe("4.0 sao");
    const overlay = el!.querySelector<HTMLElement>("span.absolute");
    expect(overlay?.style.width).toBe("80%");
  });

  it("0 review (ratingCount = 0) → ẩn sao kể cả khi rating ảo 4.5 (REVIEW_RULE_004)", () => {
    const { container } = render(
      <ProductCard product={makeProduct({ rating: 4.5, ratingCount: 0 })} variant={cardVariant} />,
    );
    expect(stars(container)).toBeNull();
  });

  it("ratingCount = null (hàng WP-import / sản phẩm mới) → ẩn sao", () => {
    const { container } = render(
      <ProductCard product={makeProduct({ rating: 4.5, ratingCount: null })} variant={cardVariant} />,
    );
    expect(stars(container)).toBeNull();
  });

  it("rating null + ratingCount null → ẩn sao", () => {
    const { container } = render(
      <ProductCard product={makeProduct({ rating: null, ratingCount: null })} variant={cardVariant} />,
    );
    expect(stars(container)).toBeNull();
  });
});
