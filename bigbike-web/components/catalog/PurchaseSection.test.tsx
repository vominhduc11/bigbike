import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/contracts/public";
import { PurchaseSection } from "./PurchaseSection";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "vi",
}));

vi.mock("@/lib/cart-context", () => ({
  useCart: () => ({ addToCart: vi.fn() }),
}));

vi.mock("@/components/catalog/ProductGallery", () => ({
  ProductGallery: () => <div data-testid="gallery" />,
}));

vi.mock("@/components/catalog/MobileStickyPurchaseBar", () => ({
  MobileStickyPurchaseBar: () => <div data-testid="sticky-bar" />,
}));


function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    slug: "ao-giap-test",
    name: "Áo giáp test",
    category: { id: "c1", slug: "ao-giap", name: "Áo giáp" },
    price: { retailPrice: 2000000, currency: "VND" },
    stockState: "IN_STOCK",
    publishStatus: "PUBLISHED",
    homepageBlock: "NONE",
    variants: [],
    createdAt: "",
    updatedAt: "",
    ...overrides,
  } as Product;
}

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function renderSection(rating: number | null, ratingCount: number | null, productOverrides: Partial<Product> = {}) {
  return renderWithQueryClient(
    <PurchaseSection
      product={makeProduct(productOverrides)}
      gallery={[]}
      rating={rating}
      ratingCount={ratingCount}
      previewMode
    />,
  );
}

describe("PurchaseSection — buy-box PDP, gate sao theo REVIEW_RULE_003", () => {
  it("ratingCount >= 1 → hiện sao (RatingStars) đúng trung bình + microdata aggregateRating", () => {
    const { container } = renderSection(4.0, 3);
    const star = container.querySelector('[aria-label$="sao"]');
    expect(star).not.toBeNull();
    expect(star!.getAttribute("aria-label")).toBe("4.0 sao");
    const aggregate = container.querySelector('[itemtype="https://schema.org/AggregateRating"]');
    expect(aggregate).not.toBeNull();
    expect(aggregate!.querySelector('[itemprop="reviewCount"]')!.textContent).toBe("3");
    expect(aggregate!.querySelector('[itemprop="ratingValue"]')!.textContent).toContain("4");
  });

  it("0 review → ẩn sao hoàn toàn, hiện 'Chưa có đánh giá', KHÔNG xuất microdata", () => {
    const { container } = renderSection(null, null);
    expect(container.querySelector('[aria-label$="sao"]')).toBeNull();
    expect(
      container.querySelector('[itemtype="https://schema.org/AggregateRating"]'),
    ).toBeNull();
    expect(screen.getByText(/noReviews/)).toBeInTheDocument();
  });

  it("rating ảo 4.5 + ratingCount 0 (hàng WP-import) → vẫn ẩn sao (REVIEW_RULE_004)", () => {
    const { container } = renderSection(4.5, 0);
    expect(container.querySelector('[aria-label$="sao"]')).toBeNull();
    expect(screen.getByText(/noReviews/)).toBeInTheDocument();
  });
});

describe("PurchaseSection — mô hình giá 2 trường (PRODUCT_RULE_012)", () => {
  it("có salePrice hợp lệ → hiện giá sale + giá niêm yết gạch ngang", () => {
    renderSection(null, null, { price: { retailPrice: 2000000, salePrice: 1500000, currency: "VND" } });
    expect(screen.getByText("1.500.000 ₫")).toBeInTheDocument();
    const old = screen.getByText("2.000.000 ₫");
    expect(old.tagName).toBe("DEL");
  });

  it("chỉ có retailPrice (salePrice trống) → hiện giá niêm yết, KHÔNG gạch ngang", () => {
    const { container } = renderSection(null, null, { price: { retailPrice: 2000000, currency: "VND" } });
    expect(screen.getByText("2.000.000 ₫")).toBeInTheDocument();
    expect(container.querySelector("del")).toBeNull();
  });
});
