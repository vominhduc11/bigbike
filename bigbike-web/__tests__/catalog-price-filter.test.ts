import { describe, expect, it } from "vitest";

import {
  buildPriceScale,
  formatPriceDisplay,
  formatPriceInput,
  getChangedPriceHandle,
  getPriceDisplayRange,
  normalizePriceSelection,
  priceRangeHasSelection,
  priceSelectionToQueryBounds,
  priceSelectionToSliderValues,
  snapPriceBound,
  snapPriceSelectionForHandle,
  sliderValuesToPriceSelection,
  snapPriceSelection,
} from "@/lib/utils/catalog-price-filter";
import type { CatalogPriceRange } from "@/lib/contracts/public";

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

describe("catalog price filter", () => {
  it("rounds visual endpoints outward using the three price bands", () => {
    expect(getPriceDisplayRange(range)).toEqual({ minPrice: 50_000, maxPrice: 12_000_000 });
    expect(getPriceDisplayRange({ ...range, minPrice: 2_300_000, maxPrice: 4_100_000 })).toEqual({
      minPrice: 2_000_000,
      maxPrice: 4_500_000,
    });
    expect(getPriceDisplayRange({ ...range, minPrice: 5_100_000, maxPrice: 11_800_000 })).toEqual({
      minPrice: 5_000_000,
      maxPrice: 12_000_000,
    });
    expect(getPriceDisplayRange({ ...range, minPrice: 1, maxPrice: 50_000 })).toEqual({
      minPrice: 1,
      maxPrice: 50_000,
    });
  });

  it("uses a density scale for a broad range and places the midpoint near the median", () => {
    const scale = buildPriceScale(range);

    expect(scale.usesDensity).toBe(true);
    expect(scale.positionToPrice(0)).toBe(50_000);
    expect(scale.positionToPrice(1_000)).toBe(12_000_000);
    expect(scale.positionToPrice(500)).toBeGreaterThan(1_500_000);
    expect(scale.positionToPrice(500)).toBeLessThan(3_000_000);
  });

  it("keeps a narrow price range linear", () => {
    const narrowRange: CatalogPriceRange = {
      minPrice: 200_000,
      maxPrice: 500_000,
      step: 50_000,
      buckets: [{ minPrice: 200_000, maxPrice: 500_000, count: 10 }],
    };
    const scale = buildPriceScale(narrowRange);

    expect(scale.usesDensity).toBe(false);
    expect(scale.positionToPrice(500)).toBe(350_000);
  });

  it("keeps all prices reachable while snapping only the committed range", () => {
    const scale = buildPriceScale(range);
    const live = sliderValuesToPriceSelection([500, 980], scale);
    const snapped = snapPriceSelection({ minPrice: 2_300_000, maxPrice: 11_800_000 }, scale);

    expect(live.minPrice).toBeGreaterThan(scale.minPrice);
    expect(live.maxPrice).toBeLessThan(scale.maxPrice);
    expect(snapped).toEqual({ minPrice: 2_000_000, maxPrice: 12_000_000 });
  });

  it("identifies exactly which handle changed", () => {
    expect(getChangedPriceHandle([120, 900], [100, 900])).toBe("min");
    expect(getChangedPriceHandle([100, 920], [100, 900])).toBe("max");
    expect(getChangedPriceHandle([100, 900], [100, 900])).toBeNull();
    expect(getChangedPriceHandle([120, 920], [100, 900])).toBeNull();
  });

  it("snaps only the dragged bound and preserves the untouched bound", () => {
    const scale = buildPriceScale(range);
    let committed = { minPrice: 1_000_000, maxPrice: 4_500_000 };

    for (const minPrice of [1_240_000, 1_860_000, 2_140_000, 2_740_000, 3_160_000]) {
      committed = snapPriceSelectionForHandle(
        { minPrice, maxPrice: 4_500_000.0001 },
        committed,
        scale,
        "min",
      );
      expect(committed.maxPrice).toBe(4_500_000);
    }

    expect(snapPriceBound(5_210_000, scale, "max")).toBe(6_000_000);
    let maxCommitted = { minPrice: 2_000_000, maxPrice: 4_500_000 };
    for (const maxPrice of [5_210_000, 6_240_000, 7_100_000, 8_250_000, 9_100_000]) {
      maxCommitted = snapPriceSelectionForHandle(
        { minPrice: 2_000_000.0001, maxPrice },
        maxCommitted,
        scale,
        "max",
      );
      expect(maxCommitted.minPrice).toBe(2_000_000);
    }
    expect(maxCommitted.maxPrice).toBe(10_000_000);
    expect(priceSelectionToQueryBounds(committed, scale)).toEqual({
      minPrice: 3_000_000,
      maxPrice: 4_500_000,
    });
  });

  it("maps full visual endpoints to an empty URL range", () => {
    const scale = buildPriceScale(range);
    const values = priceSelectionToSliderValues({ minPrice: scale.minPrice, maxPrice: scale.maxPrice }, scale);

    expect(values).toEqual([0, 1_000]);
    expect(priceSelectionToQueryBounds({ minPrice: scale.minPrice, maxPrice: scale.maxPrice }, scale)).toEqual({});
  });

  it("keeps explicit URL values exact and swaps reversed bounds", () => {
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

  it("formats full localized currency labels consistently", () => {
    expect(formatPriceInput(500_000, "vi")).toBe("500.000");
    expect(formatPriceDisplay(500_000, "vi")).toBe("500.000₫");
    expect(formatPriceDisplay(2_000_000, "en")).toBe("2,000,000 VND");
  });

  it("treats any explicit bound as an active filter", () => {
    expect(priceRangeHasSelection(range, range.minPrice, range.maxPrice)).toBe(true);
    expect(priceRangeHasSelection(range, undefined, undefined)).toBe(false);
  });
});
