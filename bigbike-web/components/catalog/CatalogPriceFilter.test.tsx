import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogPriceFilter } from "@/components/catalog/CatalogPriceFilter";
import type { CatalogPriceRange } from "@/lib/contracts/public";

const { localeState, routerState, messages } = vi.hoisted(() => ({
  localeState: { value: "vi" },
  routerState: { push: vi.fn() },
  messages: {
    vi: {
      priceFrom: "Từ",
      priceTo: "Đến",
      priceRangeAria: "Khoảng giá",
      priceMinAria: "Giá thấp nhất",
      priceMaxAria: "Giá cao nhất",
      priceRangeHint: "Khoảng giá của trang: {min} – {max}₫",
      applyPrice: "Áp dụng",
      priceAndAbove: "trở lên",
    },
    en: {
      priceFrom: "From",
      priceTo: "To",
      priceRangeAria: "Price range",
      priceMinAria: "Minimum price",
      priceMaxAria: "Maximum price",
      priceRangeHint: "Page price range: {min} – {max} VND",
      applyPrice: "Apply",
      priceAndAbove: "and above",
    },
  },
}));

vi.mock("next-intl", () => ({
  useLocale: () => localeState.value,
  useTranslations: () => (key: string, values?: { min?: string; max?: string }) => {
    const message = messages[localeState.value as "vi" | "en"][key as keyof typeof messages.vi] ?? key;
    return message.replace("{min}", values?.min ?? "").replace("{max}", values?.max ?? "");
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerState,
}));

const range: CatalogPriceRange = {
  minPrice: 50_000,
  maxPrice: 2_000_000,
  step: 50_000,
  buckets: Array.from({ length: 24 }, (_, index) => ({
    minPrice: 50_000 + index * 500_000,
    maxPrice: 550_000 + index * 500_000,
    count: index === 23 ? 100 : 0,
  })),
};

type Selection = { currentMinPrice?: number; currentMaxPrice?: number };

function renderFilter(overrides: Selection = {}) {
  const queryHref = vi.fn((override: Record<string, string | string[] | number | undefined>) => JSON.stringify(override));
  const result = render(
    <CatalogPriceFilter
      range={range}
      queryHref={queryHref}
      {...overrides}
    />,
  );
  const applyFilters = (next: Selection) => result.rerender(
    <CatalogPriceFilter
      range={{ ...range }}
      queryHref={queryHref}
      {...next}
    />,
  );
  return { ...result, queryHref, applyFilters };
}

beforeEach(() => {
  localeState.value = "vi";
  vi.clearAllMocks();
});

const nativeResizeObserver = globalThis.ResizeObserver;
beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
});
afterAll(() => {
  globalThis.ResizeObserver = nativeResizeObserver;
});

describe("CatalogPriceFilter UI contract", () => {
  it("leaves both boxes blank before filtering and uses full matching numbers", () => {
    const { container } = renderFilter();
    const thumbs = screen.getAllByRole("slider");

    expect(screen.getByLabelText("Từ")).toHaveValue("");
    expect(screen.getByLabelText("Đến")).toHaveValue("");
    expect(screen.getByLabelText("Từ")).toHaveAttribute("placeholder", "50.000");
    expect(screen.getByLabelText("Đến")).toHaveAttribute("placeholder", "2.000.000");
    expect(thumbs[0]).toHaveAttribute("aria-valuenow", "50000");
    expect(thumbs[1]).toHaveAttribute("aria-valuenow", "2000000");
    expect(thumbs[0]).toHaveAttribute("aria-valuetext", "50.000 đồng");
    expect(thumbs[1]).toHaveAttribute("aria-valuetext", "2.000.000 đồng");
    expect(container.querySelector('[data-price-filter-active="false"]')).not.toBeNull();
    expect(container.querySelector('[data-price-range-hint="true"]')).toHaveTextContent("50.000");
    expect(container.querySelectorAll('[data-price-histogram] span')).toHaveLength(24);
  });

  it("renders bilingual full-number labels and an explicit Apply action", () => {
    localeState.value = "en";
    renderFilter({ currentMinPrice: 500_000, currentMaxPrice: 2_000_000 });

    expect(screen.getByLabelText("From")).toHaveValue("500,000");
    expect(screen.getByLabelText("To")).toHaveValue("2,000,000");
    expect(screen.getByRole("button", { name: "Apply" })).toBeVisible();
  });

  it("does not apply when focus leaves the first box, then applies the exact range once", () => {
    const { queryHref } = renderFilter();
    const minimumInput = screen.getByLabelText("Từ");
    const maximumInput = screen.getByLabelText("Đến");

    act(() => (minimumInput as HTMLInputElement).focus());
    fireEvent.change(minimumInput, { target: { value: "1000000", selectionStart: 7, selectionEnd: 7 } });
    act(() => (minimumInput as HTMLInputElement).blur());
    expect(queryHref).not.toHaveBeenCalled();

    act(() => (maximumInput as HTMLInputElement).focus());
    fireEvent.change(maximumInput, { target: { value: "1800000", selectionStart: 7, selectionEnd: 7 } });
    expect(queryHref).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    expect(queryHref).toHaveBeenCalledTimes(1);
    expect(queryHref).toHaveBeenLastCalledWith({ min_price: 1_000_000, max_price: 1_800_000 });
  });

  it("keeps a manually typed out-of-scale maximum exact and swaps reversed bounds", () => {
    const { queryHref } = renderFilter();
    const minimumInput = screen.getByLabelText("Từ");
    const maximumInput = screen.getByLabelText("Đến");

    fireEvent.change(minimumInput, { target: { value: "30000000", selectionStart: 8, selectionEnd: 8 } });
    fireEvent.change(maximumInput, { target: { value: "1000000", selectionStart: 7, selectionEnd: 7 } });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));

    expect(queryHref).toHaveBeenLastCalledWith({ min_price: 1_000_000, max_price: 30_000_000 });
  });

  it("moves by round marks and keeps 44px hit areas with edge-aligned round indicators", () => {
    const { container } = renderFilter();
    const minimumThumb = screen.getAllByRole("slider")[0];
    const initialIndicators = container.querySelectorAll("[data-slider-thumb-indicator='true']");
    expect(initialIndicators[0]).toHaveAttribute("style", expect.stringContaining("translateX(-50%)"));
    expect(initialIndicators[1]).toHaveAttribute("style", expect.stringContaining("translateX(50%)"));

    minimumThumb.focus();
    fireEvent.keyDown(minimumThumb, { key: "ArrowRight", code: "ArrowRight" });
    expect(minimumThumb).toHaveAttribute("aria-valuenow", "100000");
    expect(minimumThumb).toHaveAttribute("aria-valuetext", "100.000 đồng");

    const indicators = container.querySelectorAll("[data-slider-thumb-indicator='true']");
    expect(indicators).toHaveLength(2);
    expect(indicators[0]).toHaveClass("!rounded-full");
  });

  it("resets both inputs to blank when the outside price chip removes the filter", () => {
    const { applyFilters, container } = renderFilter({ currentMinPrice: 1_000_000, currentMaxPrice: 4_000_000 });

    expect(screen.getByLabelText("Từ")).toHaveValue("1.000.000");
    expect(screen.getByLabelText("Đến")).toHaveValue("4.000.000");
    act(() => applyFilters({}));

    expect(screen.getByLabelText("Từ")).toHaveValue("");
    expect(screen.getByLabelText("Đến")).toHaveValue("");
    expect(container.querySelector('[data-price-filter-active="false"]')).not.toBeNull();
  });
});
