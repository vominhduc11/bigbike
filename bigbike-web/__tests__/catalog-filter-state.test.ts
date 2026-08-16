import { describe, expect, it } from "vitest";

import {
  clearCatalogFilters,
  countCatalogFilters,
  getAvailableCatalogFilterGroups,
  removeCatalogFilter,
  type CatalogFilterState,
} from "@/lib/utils/catalog-filter-state";

const active: CatalogFilterState = {
  brand: ["agv", "ls2"],
  color: ["den", "xam"],
  finish: ["nham"],
  size: ["clothing-letter:M"],
  gender: "Nam",
  minPrice: 500000,
  maxPrice: 2000000,
  inStock: true,
};

describe("catalog active filters", () => {
  it("counts each selected value and treats a price range as one condition", () => {
    expect(countCatalogFilters(active)).toBe(9);
  });

  it("removes one value without clearing another value in the same group", () => {
    const next = removeCatalogFilter(active, { group: "brand", value: "agv" });
    expect(next.brand).toEqual(["ls2"]);
    expect(next.color).toEqual(["den", "xam"]);
  });

  it("clear all preserves navigation/search context only", () => {
    const next = clearCatalogFilters({ ...active, q: "mũ", category: "mu-bao-hiem" });
    expect(countCatalogFilters(next)).toBe(0);
    expect(next.q).toBe("mũ");
    expect(next.category).toBe("mu-bao-hiem");
  });

  it("hides filter groups that have no values in the current catalog context", () => {
    const groups = getAvailableCatalogFilterGroups({
      categories: [],
      brands: [{ key: "agv", label: "AGV", count: 2 }],
      colors: [],
      finishes: [],
      availability: null,
      genders: [],
      sizes: [],
      sizeGroups: [],
      priceRange: null,
      resultCount: 9,
      resolvedColorKeys: [],
    });

    expect(groups).toEqual(["brand"]);
    expect(groups).not.toContain("color");
  });
});
