import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchToggle } from "./SearchToggle";

const mocks = vi.hoisted(() => ({
  closePanel: vi.fn(),
  push: vi.fn(),
  suggestionState: {
    data: {
      products: [{ id: "helmet-1", slug: "mu-bao-hiem", name: "Mũ bảo hiểm" }],
      articles: [],
    },
    error: null as Error | null,
    isFetching: false,
    refetch: vi.fn(),
  },
  recentSearches: [] as string[],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/layout/HeaderUiContext", () => ({
  useHeaderUi: () => ({ isPanelOpen: () => true, closePanel: mocks.closePanel }),
}));

vi.mock("@/lib/hooks/useDebounce", () => ({
  useDebounce: <T,>(value: T) => value,
}));

vi.mock("@/lib/hooks/useMediaQueryChange", () => ({
  useMediaQueryChange: () => undefined,
}));

vi.mock("@/lib/hooks/useRecentSearches", () => ({
  useRecentSearches: () => ({
    searches: mocks.recentSearches,
    addSearch: vi.fn(),
    removeSearch: vi.fn(),
    clearAll: vi.fn(),
  }),
}));

vi.mock("@/lib/query/search-suggestions", () => ({
  SearchSuggestionsError: class SearchSuggestionsError extends Error {},
  useSearchSuggestions: () => mocks.suggestionState,
}));

describe("SearchToggle", () => {
  beforeEach(() => {
    mocks.closePanel.mockReset();
    mocks.push.mockReset();
    mocks.suggestionState.error = null;
    mocks.suggestionState.isFetching = false;
    mocks.recentSearches = [];
  });

  it("keeps a previous suggestion visible while fetching and leaves close available", () => {
    mocks.suggestionState.isFetching = true;
    render(<SearchToggle />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "mũ bảo" } });

    expect(screen.getByRole("option", { name: /mũ bảo hiểm/i })).toBeVisible();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "closeAriaLabel" }),
    );
    expect(mocks.closePanel).toHaveBeenCalledOnce();
  });

  it("opens the highlighted suggestion with ArrowDown then Enter", () => {
    render(<SearchToggle />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "mũ" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: /mũ bảo hiểm/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(input, { key: "Enter" });
    expect(mocks.push).toHaveBeenCalledWith("/product/mu-bao-hiem/");
    expect(mocks.closePanel).toHaveBeenCalledOnce();
  });

  it("supports keyboard selection in the empty-query state", () => {
    mocks.recentSearches = ["tai nghe"];
    render(
      <SearchToggle
        shortcuts={{
          trendingBrands: [{ id: "brand-1", name: "TAICHI", href: "/brands/taichi/" }],
          suggestedProducts: [],
          popularCategories: [],
        }}
      />,
    );

    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-controls", "bb-search-suggestions");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "tai nghe" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(input).toHaveAttribute("aria-activedescendant", "bb-search-option-0");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(mocks.push).toHaveBeenCalledWith("/tim-kiem/?s=tai%20nghe");
    expect(mocks.closePanel).toHaveBeenCalledOnce();
  });

  it("closes the empty-query state with Escape", () => {
    mocks.recentSearches = ["tai nghe"];
    render(<SearchToggle />);

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(mocks.closePanel).toHaveBeenCalledOnce();
  });
});
