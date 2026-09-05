import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CatalogResults } from "@/components/catalog/CatalogResults";

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
});
