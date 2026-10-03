import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/contracts/public";
import { PurchaseSection } from "./PurchaseSection";
import { merchantVariants } from "@/__tests__/merchant/fixtures";

const { localeState, addToCartMock } = vi.hoisted(() => ({
  localeState: { value: "vi" },
  addToCartMock: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { rating?: string; count?: number }) => {
    if (key === "ratingStars") return `${values?.rating} sao`;
    if (key === "ratingAria") return `${values?.rating} sao, ${values?.count} đánh giá`;
    if (key === "emptyRatingAria") return "Chưa có đánh giá, 0 đánh giá";
    if (key === "unavailableRatingAria")
      return `Chưa có điểm trung bình, ${values?.count} đánh giá`;
    if (key === "ratingCount") return `(${values?.count})`;
    return key;
  },
  useLocale: () => localeState.value,
}));

vi.mock("@/lib/cart-context", () => ({
  useCart: () => ({ addToCart: addToCartMock }),
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
  return {
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
    queryClient,
  };
}

function renderSection(
  rating: number | null,
  ratingCount: number | null,
  productOverrides: Partial<Product> = {},
) {
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
  addToCartMock.mockReset();
  window.gtag = vi.fn();
});

afterEach(() => {
  delete window.gtag;
});

function viewedItems() {
  return vi
    .mocked(window.gtag!)
    .mock.calls.filter((call) => call[1] === "view_item")
    .map((call) => (call[2] as { items: Array<{ item_id: string }> }).items[0].item_id);
}

describe("PurchaseSection — buy-box PDP, hiển thị rating theo REVIEW_RULE_003", () => {
  it("ratingCount >= 1 → hiển thị sao đúng trung bình, không tạo Product microdata trùng", () => {
    const { container } = renderSection(4.0, 3);
    const star = container.querySelector('[aria-label="4.0 sao, 3 đánh giá"]');
    expect(star).not.toBeNull();
    expect(container.querySelector('[itemtype="https://schema.org/Product"]')).toBeNull();
    expect(container.querySelector('[itemtype="https://schema.org/AggregateRating"]')).toBeNull();
    expect(screen.queryByText("4.0")).toBeNull();
    expect(window.gtag).not.toHaveBeenCalled();
    expect(screen.getByText("(3)")).toBeInTheDocument();
  });

  it("0 review → hiển thị sao trung tính và không xuất microdata", () => {
    const { container } = renderSection(null, null);
    expect(container.querySelector('[aria-label="Chưa có đánh giá, 0 đánh giá"]')).not.toBeNull();
    expect(container.querySelector('[itemtype="https://schema.org/Product"]')).toBeNull();
    expect(container.querySelector('[itemtype="https://schema.org/AggregateRating"]')).toBeNull();
    expect(screen.getByText("(0)")).toBeInTheDocument();
    expect(screen.queryByText(/noReviews/)).toBeNull();
  });

  it("rating ảo 4.5 + ratingCount 0 → vẫn hiển thị trạng thái trung tính", () => {
    const { container } = renderSection(4.5, 0);
    expect(container.querySelector('[aria-label="Chưa có đánh giá, 0 đánh giá"]')).not.toBeNull();
    expect(screen.getByText("(0)")).toBeInTheDocument();
    expect(screen.queryByText(/noReviews/)).toBeNull();
  });

  it("count dương nhưng rating lỗi → giữ count và không xuất aggregateRating", () => {
    const { container } = renderSection(null, 3);
    expect(
      container.querySelector('[aria-label="Chưa có điểm trung bình, 3 đánh giá"]'),
    ).not.toBeNull();
    expect(screen.getByText("(3)")).toBeInTheDocument();
    expect(screen.queryByText("Chưa có điểm trung bình")).toBeNull();
    expect(container.querySelector('[itemtype="https://schema.org/AggregateRating"]')).toBeNull();
  });
});

describe("PurchaseSection — mô hình giá 2 trường (PRODUCT_RULE_012)", () => {
  it("có salePrice hợp lệ → hiện giá sale + giá niêm yết gạch ngang", () => {
    renderSection(null, null, {
      price: { retailPrice: 2000000, salePrice: 1500000, currency: "VND" },
    });
    expect(screen.getByText("1.500.000 ₫")).toBeInTheDocument();
    const old = screen.getByText("2.000.000 ₫");
    expect(old.tagName).toBe("DEL");
  });

  it("chỉ có retailPrice (salePrice trống) → hiện giá niêm yết, KHÔNG gạch ngang", () => {
    const { container } = renderSection(null, null, {
      price: { retailPrice: 2000000, currency: "VND" },
    });
    expect(screen.getByText("2.000.000 ₫")).toBeInTheDocument();
    expect(container.querySelector("del")).toBeNull();
  });
});

describe("PurchaseSection — liên kết GMC chọn sẵn biến thể", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          pricing: { retailPrice: 900000, salePrice: 800000, currency: "VND", discountPercent: 11 },
          stock: { stockState: "IN_STOCK" },
          variants: merchantVariants().variants,
        }),
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(["Màu sắc", "color"])(
    "shows one color group and resolves purchases with %s / màu sắc labels",
    (label) => {
      const product = merchantVariants();
      product.variants![0].options![0].name = label;
      product.variants![1].options![0].name = "màu sắc";
      renderWithQueryClient(
        <PurchaseSection product={product} gallery={[]} rating={null} ratingCount={null} />,
      );
      expect(screen.getAllByRole("radiogroup")).toHaveLength(2);
      fireEvent.click(screen.getByRole("radio", { name: "Đỏ" }));
      fireEvent.click(screen.getByRole("radio", { name: "L" }));
      expect(screen.getByText("stockOut")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /addToCart$/ })).toBeDisabled();
      fireEvent.click(screen.getByRole("radio", { name: "Xanh" }));
      fireEvent.click(screen.getByRole("radio", { name: "M" }));
      expect(screen.getByRole("radio", { name: "Đỏ" })).toHaveAttribute("aria-checked", "false");
      expect(screen.getByRole("button", { name: /addToCart$/ })).toBeEnabled();
      expect(screen.getByText("1.100.000 ₫")).toBeInTheDocument();
    },
  );

  it.each(["Màu sắc", "color"])(
    "keeps linked selections in one group with %s / màu sắc labels",
    (label) => {
      const product = merchantVariants();
      product.variants![0].options![0].name = label;
      product.variants![1].options![0].name = "màu sắc";
      renderWithQueryClient(
        <PurchaseSection
          product={product}
          initialVariantId="variant-red"
          gallery={[]}
          rating={null}
          ratingCount={null}
        />,
      );
      expect(screen.getAllByRole("radiogroup")).toHaveLength(2);
      expect(screen.getByRole("radio", { name: "Đỏ" })).toHaveAttribute("aria-checked", "true");
      fireEvent.click(screen.getByRole("radio", { name: "Xanh" }));
      fireEvent.click(screen.getByRole("radio", { name: "M" }));
      expect(screen.getByRole("radio", { name: "Đỏ" })).toHaveAttribute("aria-checked", "false");
      expect(screen.getByRole("button", { name: /addToCart$/ })).toBeEnabled();
      expect(viewedItems()).toEqual(["E2E_GMC_RED_L", "E2E_GMC_BLUE_M"]);
      fireEvent.click(screen.getByRole("radio", { name: "Xanh" }));
      expect(screen.getByRole("radio", { name: "Xanh" })).toHaveAttribute("aria-checked", "false");
      expect(screen.getByRole("button", { name: /addToCart$/ })).toBeDisabled();
    },
  );

  it.each(["vi", "en"])("tracks the GMC variant and completed selection changes (%s)", (locale) => {
    localeState.value = locale;
    renderWithQueryClient(
      <PurchaseSection
        product={merchantVariants()}
        initialVariantId="variant-blue"
        gallery={[]}
        rating={null}
        ratingCount={null}
      />,
    );
    expect(screen.getByText("1.100.000 ₫")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Xanh" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "M" })).toHaveAttribute("aria-checked", "true");
    expect(viewedItems()).toEqual(["E2E_GMC_BLUE_M"]);
    fireEvent.click(screen.getByRole("radio", { name: "Đỏ" }));
    expect(viewedItems()).toEqual(["E2E_GMC_BLUE_M"]);
    fireEvent.click(screen.getByRole("radio", { name: "L" }));
    expect(screen.getByText("800.000 ₫")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Xanh" })).toHaveAttribute("aria-checked", "false");
    expect(viewedItems()).toEqual(["E2E_GMC_BLUE_M", "E2E_GMC_RED_L"]);
  });

  it("does not repeat the variant view when the price/stock snapshot refreshes", async () => {
    const { queryClient } = renderWithQueryClient(
      <PurchaseSection
        product={merchantVariants()}
        initialVariantId="variant-blue"
        gallery={[]}
        rating={null}
        ratingCount={null}
      />,
    );
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    await queryClient.refetchQueries();
    expect(viewedItems()).toEqual(["E2E_GMC_BLUE_M"]);
  });

  it("keeps an unavailable linked variant unavailable instead of selecting another SKU", () => {
    renderWithQueryClient(
      <PurchaseSection
        product={merchantVariants()}
        initialVariantId="variant-red"
        gallery={[]}
        rating={null}
        ratingCount={null}
      />,
    );
    expect(screen.getByRole("radio", { name: "Đỏ" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "L" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("800.000 ₫")).toBeInTheDocument();
    expect(screen.getByText("stockOut")).toBeInTheDocument();
    expect(viewedItems()).toEqual(["E2E_GMC_RED_L"]);
  });
});

describe("PurchaseSection — Size và Kích cỡ là một nhóm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["vi", undefined],
    ["en", undefined],
    ["vi", "size-bxl"],
    ["en", "size-bxl"],
  ] as const)(
    "switches sizes and adds the exact variant (%s, linked=%s)",
    async (locale, linked) => {
      localeState.value = locale;
      const product = makeProduct({
        variants: ["XL", "BXL", "XXL"].map((size, index) => ({
          id: `size-${size.toLowerCase()}`,
          name: size,
          sku: `E2E_SIZE_${size}`,
          options: [{ name: size === "BXL" ? "Kích cỡ" : "Size", value: size }],
          stockState: "IN_STOCK",
          isAvailable: true,
          price: { retailPrice: (index + 1) * 1000000, currency: "VND" },
        })),
      });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            pricing: product.price,
            stock: { stockState: "IN_STOCK" },
            variants: product.variants,
          }),
        }),
      );
      const { queryClient } = renderWithQueryClient(
        <PurchaseSection
          product={product}
          initialVariantId={linked}
          gallery={[]}
          rating={null}
          ratingCount={null}
        />,
      );
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.getAllByRole("radiogroup")).toHaveLength(1);
      expect(screen.getAllByRole("radio")).toHaveLength(3);
      const add = screen.getByRole("button", { name: /addToCart$/ });
      if (linked) {
        expect(screen.getByRole("radio", { name: "BXL" })).toHaveAttribute("aria-checked", "true");
        expect(add).toBeEnabled();
      } else {
        expect(add).toBeDisabled();
      }
      for (const size of ["XXL", "BXL", "XL"]) {
        fireEvent.click(screen.getByRole("radio", { name: size }));
        expect(screen.getAllByRole("radio", { checked: true })).toHaveLength(1);
        expect(screen.getByRole("radio", { name: size })).toHaveAttribute("aria-checked", "true");
        expect(add).toBeEnabled();
        fireEvent.click(add);
        await waitFor(() =>
          expect(addToCartMock).toHaveBeenLastCalledWith(
            product.id,
            1,
            `size-${size.toLowerCase()}`,
          ),
        );
        await waitFor(() => expect(add).toBeEnabled());
      }
      expect(screen.getByText("1.000.000 ₫")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("radio", { name: "XL" }));
      expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
      expect(add).toBeDisabled();
    },
  );
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
    expect(screen.getByText("Áo giáp")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "BigBike" })).toHaveAttribute(
      "href",
      "/en/brands/bigbike",
    );
    expect(screen.getByText("Hàng chính hãng")).toBeInTheDocument();
    expect(screen.getByText("Miễn phí vận chuyển")).toBeInTheDocument();
  });
});
