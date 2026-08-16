import { describe, expect, it } from "vitest";

import {
  buildPriceScale,
  buildPriceTicks,
  formatPriceInput,
  normalizePriceSelection,
  parsePriceInput,
  priceSelectionToTickIndexes,
  priceRangeHasSelection,
  tickIndexesToPriceSelection,
} from "@/lib/utils/catalog-price-filter";
import type { CatalogPriceRange } from "@/lib/contracts/public";

const range: CatalogPriceRange = {
  minPrice: 380_000,
  maxPrice: 1_250_000,
  step: 50_000,
  buckets: [],
};

describe("catalog price filter", () => {
  it("uses round interior marks instead of counting from the cheapest product", () => {
    const ticks = buildPriceTicks(range);

    expect(ticks[0]).toBe(380_000);
    expect(ticks).toContain(400_000);
    expect(ticks).toContain(1_000_000);
    expect(ticks.at(-1)).toBe(1_250_000);
    expect(ticks.filter((value) => value >= 400_000 && value < 1_000_000).every((value) => value % 50_000 === 0)).toBe(true);
  });

  it("keeps typed integers exact, including values outside the visual scale", () => {
    expect(normalizePriceSelection(range, 1_000_001, 500_001)).toMatchObject({
      minPrice: 500_001,
      maxPrice: 1_000_001,
      queryMinPrice: 500_001,
      queryMaxPrice: 1_000_001,
    });
    expect(normalizePriceSelection(range, undefined, 30_000_000)).toMatchObject({
      minPrice: range.minPrice,
      maxPrice: 30_000_000,
      queryMinPrice: undefined,
      queryMaxPrice: 30_000_000,
    });
  });

  it("uses a density cap and makes the last display mark open-ended", () => {
    const longTail: CatalogPriceRange = {
      minPrice: 50_000,
      maxPrice: 30_000_000,
      step: 50_000,
      buckets: [
        { minPrice: 50_000, maxPrice: 3_000_000, count: 90 },
        { minPrice: 3_000_001, maxPrice: 10_000_000, count: 9 },
        { minPrice: 10_000_001, maxPrice: 30_000_000, count: 1 },
      ],
    };
    const scale = buildPriceScale(longTail);

    expect(scale.ticks.length).toBeLessThanOrEqual(64);
    expect(scale.openEndedIndex).toBe(scale.ticks.length - 1);
    expect(scale.openEndedValue).toBe(3_000_000);
    expect(scale.ticks.at(-1)).toBe(3_000_000);
  });

  it("keeps an exact typed value visible on the slider even past the density cap", () => {
    const longTail: CatalogPriceRange = {
      minPrice: 50_000,
      maxPrice: 30_000_000,
      step: 50_000,
      buckets: [
        { minPrice: 50_000, maxPrice: 3_000_000, count: 90 },
        { minPrice: 3_000_001, maxPrice: 10_000_000, count: 9 },
        { minPrice: 10_000_001, maxPrice: 30_000_000, count: 1 },
      ],
    };
    const scale = buildPriceScale(longTail, [30_000_000]);

    expect(scale.ticks.at(-1)).toBe(30_000_000);
    expect(scale.openEndedValue).toBe(3_000_000);
    expect(scale.openEndedIndex).toBeLessThan(scale.ticks.length - 1);
  });

  it("formats and parses locale input while preserving empty edits", () => {
    expect(formatPriceInput(500_000, "vi")).toBe("500.000");
    expect(formatPriceInput(2_000_000, "en")).toBe("2,000,000");
    expect(formatPriceInput("", "vi")).toBe("");

    expect(parsePriceInput("500.000", "vi")).toBe(500_000);
    expect(parsePriceInput("2,000,000", "en")).toBe(2_000_000);
    expect(parsePriceInput("", "vi")).toBeUndefined();
    expect(parsePriceInput("-", "vi")).toBeUndefined();
  });

  it("maps exact committed values and treats any explicit bound as active", () => {
    const scale = buildPriceScale(range, [430_000, 1_030_000]);
    const indexes = priceSelectionToTickIndexes(range, { minPrice: 430_000, maxPrice: 1_030_000 }, scale);

    expect(tickIndexesToPriceSelection(range, indexes, scale)).toEqual({ minPrice: 430_000, maxPrice: 1_030_000 });
    expect(priceRangeHasSelection(range, range.minPrice, range.maxPrice)).toBe(true);
    expect(priceRangeHasSelection(range, undefined, undefined)).toBe(false);
  });
});
