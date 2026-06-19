import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PurchaseSectionClient } from "./PurchaseSectionClient";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    return t;
  },
  useLocale: () => "vi",
}));

vi.mock("@/lib/cart-context", () => ({
  useCart: () => ({ addToCart: vi.fn() }),
}));

vi.mock("./ProductGallery", () => ({
  ProductGallery: () => <div data-testid="gallery" />,
}));

vi.mock("./PricingPanel", () => ({
  PricingPanel: () => <div data-testid="pricing" />,
}));

vi.mock("./StockStatus", () => ({
  StockStatus: () => <span data-testid="stock" />,
}));

vi.mock("./VariantSelector", () => ({
  VariantSelector: () => <div data-testid="variants" />,
}));

vi.mock("./QuickBuyModal", () => ({
  QuickBuyModal: () => null,
}));

vi.mock("./QuickBuySuccessModal", () => ({
  QuickBuySuccessModal: () => null,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderSection(initialRating: number | null, initialRatingCount: number | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ pricing: null, stock: null, variants: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PurchaseSectionClient
        productId="p1"
        productSlug="ao-giap-test"
        productName="Áo giáp test"
        brandName="BigBike"
        categoryName="Áo giáp"
        categoryId="c1"
        shortDescription={null}
        initialRating={initialRating}
        initialRatingCount={initialRatingCount}
        mainImage={null}
        gallery={[]}
        fallbackPrice={{ retailPrice: 2000000, currency: "VND" }}
        fallbackStockState="IN_STOCK"
        fallbackVariants={[]}
        canonicalUrl="https://example.test/san-pham/ao-giap-test"
      />
    </QueryClientProvider>,
  );
}

describe("PurchaseSectionClient — RatingRow, gate sao theo REVIEW_RULE_003", () => {
  it("ratingCount >= 1 → hiện 5 sao tô đúng trung bình + reviewCount", () => {
    const { container } = renderSection(3.5, 2);
    const stars = container.querySelector('[aria-label="3.5 sao"]');
    expect(stars).not.toBeNull();
    const overlay = stars!.querySelector<HTMLElement>("span.absolute");
    expect(overlay?.style.width).toBe("70%");
    expect(container.querySelector('[itemprop="reviewCount"]')!.textContent).toBe("2");
  });

  it("0 review → ẩn sao, hiện noReviews, không xuất microdata", () => {
    const { container } = renderSection(null, null);
    expect(container.querySelector('[aria-label$=" sao"]')).toBeNull();
    expect(
      container.querySelector('[itemtype="https://schema.org/AggregateRating"]'),
    ).toBeNull();
    expect(screen.getByText("noReviews")).toBeInTheDocument();
  });

  it("rating ảo 4.5 + ratingCount 0 → vẫn ẩn sao (REVIEW_RULE_004)", () => {
    const { container } = renderSection(4.5, 0);
    expect(container.querySelector('[aria-label$=" sao"]')).toBeNull();
    expect(screen.getByText("noReviews")).toBeInTheDocument();
  });
});
