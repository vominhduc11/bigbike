import { describe, expect, it } from "vitest";
import { parseCatalogListParams, toggleCatalogGenderFilter } from "@/lib/utils/catalog-list-params";
import { buildQueryString, hasPriceRangeFilter } from "@/lib/utils/query";

describe("catalog gender filter query contract", () => {
  it("marks price-range URLs as noindex candidates even when the value is empty", () => {
    expect(hasPriceRangeFilter({ min_price: "500000" })).toBe(true);
    expect(hasPriceRangeFilter({ max_price: "1000000" })).toBe(true);
    expect(hasPriceRangeFilter({ min_price: "" })).toBe(true);
    expect(hasPriceRangeFilter({ page: "2" })).toBe(false);
  });

  it("parses one gender and keeps the first value from old repeated URLs", () => {
    const parsed = parseCatalogListParams({
      filter_gender: ["Nam", "Nữ", "Unisex", "nam", "  nữ  "],
    });

    expect(parsed.filters.gender).toBe("Nam");
    expect(parsed.validationErrors).toEqual([]);

    const legacy = parseCatalogListParams({ filter_gender: "Nam" });
    expect(legacy.filters.gender).toBe("Nam");
  });

  it("serializes one selected gender", () => {
    const query = buildQueryString({ filter_gender: "Nữ" });

    expect(query).toBe("?filter_gender=N%E1%BB%AF");
    expect(query).not.toContain("Nam%2CN");
  });

  it("clicking the active gender clears the storefront filter", () => {
    expect(toggleCatalogGenderFilter(undefined, "Nam")).toBe("Nam");
    expect(toggleCatalogGenderFilter("Nam", "Nữ")).toBe("Nữ");
    expect(toggleCatalogGenderFilter("Nam", "Nam")).toBeUndefined();
  });
});

describe("catalog size filter query contract", () => {
  it.each([
    ["XXL", "XXL"],
    ["3xl", "3XL"],
    ["xxxl", "3XL"],
    ["39", "39"],
    ["46", "46"],
  ])("normalizes %s to %s", (input, expected) => {
    const parsed = parseCatalogListParams({ "kich-co": input });
    expect(parsed.filters.size).toEqual([expected]);
    expect(parsed.validationErrors).toEqual([]);
  });

  it("keeps the normalized size when building pagination links", () => {
    const parsed = parseCatalogListParams({ "kich-co": "xxxl", page: "3" });

    expect(parsed.buildPaginationHref("/sp/")).toContain("kich-co=3XL");
    expect(parsed.buildPaginationHref("/sp/")).not.toContain("kich-co=xxxl");
  });

  it("keeps repeated namespaced size values and canonicalizes aliases", () => {
    const parsed = parseCatalogListParams({ "kich-co": ["shoe:42", "pants-waist:42", "2xl", "2XL"] });

    expect(parsed.filters.size).toEqual(["shoe:42", "pants-waist:42", "XXL"]);
    expect(parsed.validationErrors).toEqual([]);
  });
});

describe("catalog multi-select query contract", () => {
  it("keeps repeated brands, colors and finishes as distinct OR values", () => {
    const parsed = parseCatalogListParams({
      "pwb-brand": ["agv", "ls2", "agv"],
      filter_color: ["den", "xam"],
      filter_finish: ["nham", "carbon"],
      in_stock: "true",
    });

    expect(parsed.filters.brand).toEqual(["agv", "ls2"]);
    expect(parsed.filters.color).toEqual(["den", "xam"]);
    expect(parsed.filters.finish).toEqual(["nham", "carbon"]);
    expect(parsed.filters.inStock).toBe(true);
    expect(parsed.validationErrors).toEqual([]);
  });

  it("preserves every active value in pagination links", () => {
    const parsed = parseCatalogListParams({
      "pwb-brand": ["agv", "ls2"],
      filter_color: ["den", "xam"],
      in_stock: "1",
    });
    const href = parsed.buildPaginationHref("/sp/");

    expect(href).toContain("pwb-brand=agv");
    expect(href).toContain("pwb-brand=ls2");
    expect(href).toContain("filter_color=den");
    expect(href).toContain("filter_color=xam");
    expect(href).toContain("in_stock=true");
  });
});

describe("catalog price URL compatibility", () => {
  it("keeps numeric legacy bounds usable and swaps them before requesting products", () => {
    const parsed = parseCatalogListParams({ min_price: "2000000", max_price: "500000" });

    expect(parsed.filters.minPrice).toBe(500000);
    expect(parsed.filters.maxPrice).toBe(2000000);
    expect(parsed.validationErrors).toEqual([]);
  });

  it("does not make numeric outliers a red validation state", () => {
    const parsed = parseCatalogListParams({ min_price: "-500000", max_price: "999999999999" });

    expect(parsed.filters.minPrice).toBe(0);
    expect(parsed.filters.maxPrice).toBe(1_000_000_000);
    expect(parsed.validationErrors).toEqual([]);
  });

  it("rounds numeric price URLs before the catalog range is applied", () => {
    const parsed = parseCatalogListParams({ min_price: "490000.6", max_price: "1999999.4" });

    expect(parsed.filters.minPrice).toBe(490001);
    expect(parsed.filters.maxPrice).toBe(1999999);
    expect(parsed.validationErrors).toEqual([]);
  });
});
