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

  it("keeps a previous suggestion visible while fetching and shows the busy state in the one action slot", () => {
    mocks.suggestionState.isFetching = true;
    render(<SearchToggle />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "mũ bảo" } });

    expect(screen.getByRole("option", { name: /mũ bảo hiểm/i })).toBeVisible();
    // Owner decision 2026-09-07: the spinner replaces the X in the SAME slot instead of sitting
    // in a second one, so while a lookup is in flight the action reads as busy and is not
    // clickable. Escape and the keyboard still clear and close.
    const action = within(screen.getByRole("search")).getByRole("button", {
      name: "loadingSuggestions",
    });
    expect(action).toBeVisible();
    expect(action).toBeDisabled();
    expect(action).toHaveAttribute("data-search-busy", "true");
  });

  it("renders one X action and changes it from close to clear as the query changes", () => {
    render(<SearchToggle />);
    const search = screen.getByRole("search");
    const input = screen.getByRole("combobox");

    expect(within(search).getAllByRole("button")).toHaveLength(1);
    expect(within(search).getByRole("button", { name: "closeAriaLabel" })).toBeVisible();

    fireEvent.change(input, { target: { value: "mũ" } });

    expect(within(search).getAllByRole("button")).toHaveLength(1);
    expect(within(search).getByRole("button", { name: "clearAriaLabel" })).toBeVisible();
    expect(within(search).queryByRole("button", { name: "closeAriaLabel" })).toBeNull();
  });

  it("clears a non-empty query, keeps focus, and does not close the overlay", () => {
    render(<SearchToggle />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "mũ" } });

    fireEvent.click(screen.getByRole("button", { name: "clearAriaLabel" }));

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(mocks.closePanel).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("search")).getByRole("button", { name: "closeAriaLabel" }),
    ).toBeVisible();
  });

  it("closes the overlay from the single X when the query is empty", () => {
    render(<SearchToggle />);

    fireEvent.click(
      within(screen.getByRole("search")).getByRole("button", { name: "closeAriaLabel" }),
    );

    expect(mocks.closePanel).toHaveBeenCalledOnce();
  });

  it("uses one fixed-size action slot for close, clear and busy", () => {
    const { rerender } = render(<SearchToggle />);
    const search = screen.getByRole("search");
    const slot = search.querySelector<HTMLElement>("[data-search-action-slot]");

    expect(slot).not.toBeNull();
    if (!slot) throw new Error("Search action slot was not rendered");
    // Exactly one control in the form — the separate spinner slot is gone, which is what gives
    // the mobile input its width back.
    expect(within(search).getAllByRole("button")).toHaveLength(1);
    expect(slot.querySelector("svg")).not.toHaveClass("animate-spin");

    // The icon must not shrink once the customer starts typing (it used to go 20px -> 16px and
    // read as a different control).
    const idleIconSize = slot.querySelector("svg")?.getAttribute("width");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "mũ" } });
    expect(slot.querySelector("svg")?.getAttribute("width")).toBe(idleIconSize);

    mocks.suggestionState.isFetching = true;
    rerender(<SearchToggle />);
    const busySlot = screen
      .getByRole("search")
      .querySelector<HTMLElement>("[data-search-action-slot]");

    expect(busySlot).toBe(slot);
    expect(busySlot?.querySelector("svg")).toHaveClass("animate-spin");
    expect(busySlot?.querySelector("svg")?.getAttribute("width")).toBe(idleIconSize);
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

  it("closes the overlay when the backdrop is clicked", () => {
    render(<SearchToggle />);
    const dialog = screen.getByRole("dialog");
    const overlay = dialog.parentElement?.querySelector<HTMLButtonElement>("button");

    expect(overlay).not.toBeNull();
    if (!overlay) throw new Error("Search overlay backdrop was not rendered");

    fireEvent.click(overlay);
    expect(mocks.closePanel).toHaveBeenCalledOnce();
  });
});
