import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { PreSuggestions } from "./PreSuggestions";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("PreSuggestions", () => {
  it("uses direct routes supplied by inventory-backed shortcuts", () => {
    render(
      <PreSuggestions
        recentSearches={[]}
        shortcuts={{
          trendingBrands: [{ id: "brand-kyt", name: "KYT", href: "/brands/kyt/", count: 2 }],
          suggestedProducts: [{ id: "product-1", name: "Mũ touring", href: "/product/mu-touring/" }],
          popularCategories: [{ id: "category-1", name: "Mũ bảo hiểm", href: "/danh-muc/mu-bao-hiem/", count: 4 }],
        }}
        runSearch={vi.fn()}
        removeSearch={vi.fn()}
        clearAll={vi.fn()}
        handleClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "KYT" })).toHaveAttribute("href", "/brands/kyt");
    expect(screen.getByRole("link", { name: "Mũ touring" })).toHaveAttribute("href", "/product/mu-touring");
    expect(screen.getByRole("link", { name: "Mũ bảo hiểm" })).toHaveAttribute("href", "/danh-muc/mu-bao-hiem");
  });
});
