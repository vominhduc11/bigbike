import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CatalogResults } from "@/components/catalog/CatalogResults";
import type { Product } from "@/lib/contracts/public";

const mocks = vi.hoisted(() => ({ trackViewItemList: vi.fn() }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      activeFilters: "Active filters",
      noMatchingProducts: "No products match — try removing some filters?",
    })[key] ?? key,
}));

vi.mock("@/components/catalog/CatalogPagination", () => ({
  CatalogPagination: () => null,
}));

vi.mock("@/components/catalog/CatalogSort", () => ({
  CatalogSort: () => null,
}));

vi.mock("@/components/catalog/MobileFilterTrigger", () => ({
  MobileFilterTrigger: () => null,
}));

vi.mock("@/components/catalog/ProductCard", () => ({
  ProductCard: ({ product }: { product: Product }) => (
    <div data-testid="recommendation-card">{product.name}</div>
  ),
}));

vi.mock("@/lib/analytics", () => ({ trackViewItemList: mocks.trackViewItemList }));

describe("CatalogResults error state", () => {
  it("does not rewrite a system failure as an empty filtered result", () => {
    render(
      <CatalogResults
        orderbyCurrent="menu_order"
        products={[]}
        notice="The system is having trouble right now. Please try again later."
        error
        activeFilterCount={1}
        activeFilters={<span>Active filter</span>}
        paginationBaseHref="/sp/"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "The system is having trouble right now. Please try again later.",
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("No products match");
    expect(screen.getByRole("status")).not.toHaveTextContent("Active filter");
  });

  it("keeps the filtered empty-result message for a genuine empty result", () => {
    render(
      <CatalogResults
        orderbyCurrent="menu_order"
        products={[]}
        notice="No products found."
        activeFilterCount={1}
        activeFilters={<span>Active filter</span>}
        paginationBaseHref="/sp/"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("No products match");
    expect(screen.getByRole("status")).toHaveTextContent("Active filter");
  });

  it("shows and measures suggested products below a genuine empty result", async () => {
    const recommendation = {
      id: "p-1",
      sku: "SKU-1",
      slug: "mu-bao-hiem-goi-y",
      name: "Mũ bảo hiểm gợi ý",
      price: { retailPrice: 1000000, salePrice: null, currency: "VND" },
      stockState: "IN_STOCK",
    } as Product;
    const list = { id: "search_recommendations", name: "Sản phẩm gợi ý" };

    render(
      <CatalogResults
        orderbyCurrent="menu_order"
        products={[]}
        notice="No products found."
        paginationBaseHref="/tim-kiem/?s=none"
        emptyRecommendations={[recommendation]}
        emptyRecommendationsLabel="Sản phẩm gợi ý"
        emptyRecommendationsAnalyticsList={list}
      />,
    );

    expect(screen.getByRole("heading", { name: "Sản phẩm gợi ý" })).toBeVisible();
    expect(screen.getByTestId("recommendation-card")).toHaveTextContent("Mũ bảo hiểm gợi ý");
    await waitFor(() =>
      expect(mocks.trackViewItemList).toHaveBeenCalledWith([recommendation], list),
    );
  });
});
