import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/contracts/public";
import { PurchaseSection } from "./PurchaseSection";

const { localeState } = vi.hoisted(() => ({ localeState: { value: "vi" } }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { rating?: string; count?: number }) => {
    if (key === "ratingStars") return `${values?.rating} sao`;
    if (key === "ratingAria") return `${values?.rating} sao, ${values?.count} đánh giá`;
    if (key === "emptyRatingAria") return "Chưa có đánh giá, 0 đánh giá";
    if (key === "unavailableRatingAria") return `Chưa có điểm trung bình, ${values?.count} đánh giá`;
    if (key === "ratingCount") return `${values?.count} đánh giá`;
    if (key === "ratingUnavailable") return "Chưa có điểm trung bình";
    return key;
  },
  useLocale: () => localeState.value,
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

beforeEach(() => {
  localeState.value = "vi";
});

describe("PurchaseSection — buy-box PDP, hiển thị rating theo REVIEW_RULE_003", () => {
  it("ratingCount >= 1 → hiển thị sao đúng trung bình + microdata aggregateRating", () => {
    const { container } = renderSection(4.0, 3);
    const star = container.querySelector('[aria-label="4.0 sao, 3 đánh giá"]');
    expect(star).not.toBeNull();
    const aggregate = container.querySelector('[itemtype="https://schema.org/AggregateRating"]');
    expect(aggregate).not.toBeNull();
    // reviewCount đi bằng <meta> để không in số lượt 2 lần cạnh nhãn "3 đánh giá".
    expect(aggregate!.querySelector('meta[itemprop="reviewCount"]')!.getAttribute("content")).toBe("3");
    expect(aggregate!.querySelector('[itemprop="ratingValue"]')!.textContent).toContain("4");
  });

  it("0 review → hiển thị sao trung tính và không xuất microdata", () => {
    const { container } = renderSection(null, null);
    expect(container.querySelector('[aria-label="Chưa có đánh giá, 0 đánh giá"]')).not.toBeNull();
    expect(
      container.querySelector('[itemtype="https://schema.org/AggregateRating"]'),
    ).toBeNull();
    expect(screen.getByText(/noReviews/)).toBeInTheDocument();
  });

  it("rating ảo 4.5 + ratingCount 0 → vẫn hiển thị trạng thái trung tính", () => {
    const { container } = renderSection(4.5, 0);
    expect(container.querySelector('[aria-label="Chưa có đánh giá, 0 đánh giá"]')).not.toBeNull();
    expect(screen.getByText(/noReviews/)).toBeInTheDocument();
  });

  it("count dương nhưng rating lỗi → giữ count và không xuất aggregateRating", () => {
    const { container } = renderSection(null, 3);
    expect(container.querySelector('[aria-label="Chưa có điểm trung bình, 3 đánh giá"]')).not.toBeNull();
    expect(screen.getByText("3 đánh giá")).toBeInTheDocument();
    expect(container.querySelector('[itemtype="https://schema.org/AggregateRating"]')).toBeNull();
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

describe("PurchaseSection — fallback nội dung tiếng Việt", () => {
  it("giữ tên, taxonomy, trust và cam kết VI khi payload EN chưa tải hoặc lỗi", () => {
    localeState.value = "en";
    renderSection(null, null, {
      name: "Áo giáp tiếng Việt",
      category: { id: "c1", slug: "ao-giap", name: "Áo giáp" },
      brand: { id: "b1", slug: "bigbike", name: "BigBike" },
      trustBadges: "<p>Hàng chính hãng</p>",
      commitments: [{ icon: "truck", title: "Miễn phí vận chuyển" }],
    });

    expect(screen.getByRole("heading", { name: "Áo giáp tiếng Việt" })).toBeInTheDocument();
    expect(screen.getByText("Áo giáp / BigBike")).toBeInTheDocument();
    expect(screen.getByText("Hàng chính hãng")).toBeInTheDocument();
    expect(screen.getByText("Miễn phí vận chuyển")).toBeInTheDocument();
  });
});
