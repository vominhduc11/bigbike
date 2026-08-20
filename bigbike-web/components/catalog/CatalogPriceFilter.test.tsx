import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogPriceFilter } from "@/components/catalog/CatalogPriceFilter";
import type { CatalogPriceRange } from "@/lib/contracts/public";

const { localeState, routerState } = vi.hoisted(() => ({
  localeState: { value: "vi" },
  routerState: { push: vi.fn() },
}));

vi.mock("next-intl", () => ({
  useLocale: () => localeState.value,
  useTranslations: () => (key: string) => ({
    priceRangeAria: localeState.value === "vi" ? "Khoảng giá" : "Price range",
    priceMinAria: localeState.value === "vi" ? "Giá thấp nhất" : "Minimum price",
    priceMaxAria: localeState.value === "vi" ? "Giá cao nhất" : "Maximum price",
  }[key] ?? key),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerState,
}));

const range: CatalogPriceRange = {
  minPrice: 55_000,
  maxPrice: 11_800_000,
  step: 50_000,
  buckets: [
    { minPrice: 55_000, maxPrice: 2_000_000, count: 50 },
    { minPrice: 2_000_001, maxPrice: 6_000_000, count: 38 },
    { minPrice: 6_000_001, maxPrice: 11_800_000, count: 12 },
  ],
};

function renderFilter(overrides: Partial<{
  currentMinPrice?: number;
  currentMaxPrice?: number;
}> = {}) {
  const queryHref = vi.fn((override: Record<string, string | string[] | number | undefined>) => JSON.stringify(override));
  const result = render(
    <CatalogPriceFilter
      range={range}
      queryHref={queryHref}
      {...overrides}
    />,
  );
  return { ...result, queryHref };
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
  it("renders only one fixed endpoint line and one continuous slider", () => {
    const { container } = renderFilter();
    const thumbs = screen.getAllByRole("slider");
    const endpointLine = container.querySelector('[data-price-range-label="true"]');

    expect(endpointLine).toHaveTextContent("50.000₫");
    expect(endpointLine).toHaveTextContent("12.000.000₫");
    expect(container.querySelectorAll('[data-price-input]').length).toBe(0);
    expect(container.querySelector('[data-price-range-hint]')).toBeNull();
    expect(container.querySelector('[data-price-apply]')).toBeNull();
    expect(container.querySelectorAll('[data-price-thumb-label]').length).toBe(0);
    expect(container.querySelector('[data-price-filter-active="false"]')).not.toBeNull();
    expect(container.querySelector('[data-price-scale-density="true"]')).not.toBeNull();
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0]).toHaveAttribute("aria-valuemin", "50000");
    expect(thumbs[0]).toHaveAttribute("aria-valuemax", "12000000");
    expect(thumbs[0]).toHaveAttribute("aria-valuenow", "50000");
    expect(thumbs[1]).toHaveAttribute("aria-valuenow", "12000000");
    expect(thumbs[0]).toHaveAttribute("aria-valuetext", "50.000₫");
    expect(thumbs[1]).toHaveAttribute("aria-valuetext", "12.000.000₫");
  });

  it("keeps the endpoint line stable when the handles are close", () => {
    const { container } = renderFilter({ currentMinPrice: 2_000_000, currentMaxPrice: 2_500_000 });
    const endpointLine = container.querySelector('[data-price-range-label="true"]');

    expect(endpointLine).toHaveTextContent("2.000.000₫");
    expect(endpointLine).toHaveTextContent("2.500.000₫");
    expect(container.querySelectorAll('[data-price-range-label="true"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-price-thumb-label]')).toHaveLength(0);
  });

  it("uses full currency labels in English and keeps the 44px thumb hit areas", () => {
    localeState.value = "en";
    const { container } = renderFilter({ currentMinPrice: 2_000_000, currentMaxPrice: 4_000_000 });
    const thumbs = screen.getAllByRole("slider");
    const indicators = container.querySelectorAll('[data-slider-thumb-indicator="true"]');

    expect(container.querySelector('[data-price-range-label="true"]')).toHaveTextContent("2,000,000 VND");
    expect(container.querySelector('[data-price-range-label="true"]')).toHaveTextContent("4,000,000 VND");
    expect(thumbs[0]).toHaveClass("h-11", "w-11");
    expect(thumbs[1]).toHaveClass("h-11", "w-11");
    expect(indicators).toHaveLength(2);
    expect(indicators[0]).toHaveClass("!rounded-full");
    expect(thumbs[0]).not.toContainElement(indicators[0]);
    expect(thumbs[1]).not.toContainElement(indicators[1]);
    expect(container.querySelector('[data-slider-track="true"]')).not.toBeNull();
    expect(container.querySelector('[data-slider-range="true"]')).not.toBeNull();
  });
});
