import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { PreSuggestions } from "./PreSuggestions";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("PreSuggestions", () => {
  const shortcuts = {
    trendingBrands: ["TAICHI", "LS2", "GIVI", "KOMINE", "ILM"].map((name, index) => ({
      id: `brand-${index}`,
      name,
      href: `/brands/${name.toLowerCase()}/`,
      count: 5 - index,
    })),
    suggestedProducts: [
      "Balo phượt Givi EA104C",
      "Găng tay moto mùa hè Komine GK-265 R-spec Racing",
      "Áo giáp moto adventure Spyke Sahara Vented",
      "Giày moto touring Komine BK-300",
      "Áo giáp moto mùa hè LS2 AIRY",
    ].map((name, index) => ({
      id: `product-${index}`,
      name,
      href: `/product/product-${index}/`,
      image: { url: `/product-${index}.jpg` },
      price: { retailPrice: (index + 1) * 100000, salePrice: null, currency: "VND" as const },
    })),
    popularCategories: [
      { id: "category-1", name: "Mũ bảo hiểm", href: "/danh-muc/mu-bao-hiem/", count: 4 },
    ],
  };

  it("uses direct routes supplied by inventory-backed shortcuts", () => {
    render(
      <PreSuggestions
        recentSearches={[]}
        shortcuts={shortcuts}
        runSearch={vi.fn()}
        removeSearch={vi.fn()}
        clearAll={vi.fn()}
        handleClose={vi.fn()}
        activeIndex={-1}
      />,
    );

    expect(screen.getByRole("option", { name: "TAICHI" })).toHaveAttribute(
      "href",
      "/brands/taichi",
    );
    expect(screen.getByRole("option", { name: /Balo phượt Givi EA104C/ })).toHaveAttribute(
      "href",
      "/product/product-0",
    );
    expect(screen.queryByRole("link", { name: "Mũ bảo hiểm" })).not.toBeInTheDocument();
  });

  it("keeps the empty state compact and renders products as product rows", () => {
    render(
      <PreSuggestions
        recentSearches={["tai nghe", "Alpinestars", "shoei", "balo", "mũ"]}
        shortcuts={shortcuts}
        runSearch={vi.fn()}
        removeSearch={vi.fn()}
        clearAll={vi.fn()}
        handleClose={vi.fn()}
        activeIndex={-1}
      />,
    );

    expect(screen.getByRole("listbox")).toHaveAttribute("aria-label", "suggestionsLabel");
    expect(screen.getAllByRole("option")).toHaveLength(13);
    expect(screen.getByText("tai nghe")).not.toHaveClass("uppercase");
    expect(screen.getByText("Balo phượt Givi EA104C")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Balo phượt Givi EA104C.*100\.000/ }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("Balo phượt Givi EA104C")).toBeInTheDocument();
    expect(screen.queryByText("Mũ bảo hiểm")).not.toBeInTheDocument();
  });

  it("requires confirmation before clearing recent searches", () => {
    const clearAll = vi.fn();
    render(
      <PreSuggestions
        recentSearches={["tai nghe"]}
        shortcuts={{ trendingBrands: [], suggestedProducts: [], popularCategories: [] }}
        runSearch={vi.fn()}
        removeSearch={vi.fn()}
        clearAll={clearAll}
        handleClose={vi.fn()}
        activeIndex={-1}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "recentClear" }));
    expect(clearAll).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "confirmClearRecent" }));
    expect(clearAll).toHaveBeenCalledOnce();
  });
});
