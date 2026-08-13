import { describe, expect, it } from "vitest";
import { parseCatalogListParams } from "@/lib/utils/catalog-list-params";
import { buildQueryString } from "@/lib/utils/query";

describe("catalog gender filter query contract", () => {
  it("parses repeated and legacy single gender params, dropping unknown values", () => {
    const parsed = parseCatalogListParams({
      filter_gender: ["Nam", "Nữ", "Unisex", "nam", "  nữ  "],
    });

    expect(parsed.filters.gender).toEqual(["Nam", "Nữ"]);
    expect(parsed.validationErrors).toEqual([]);

    const legacy = parseCatalogListParams({ filter_gender: "Nam" });
    expect(legacy.filters.gender).toEqual(["Nam"]);
  });

  it("serializes selected genders as repeated query params, never CSV", () => {
    const query = buildQueryString({ filter_gender: ["Nam", "Nữ"] });

    expect(query).toBe("?filter_gender=Nam&filter_gender=N%E1%BB%AF");
    expect(query).not.toContain("Nam%2CN");
  });
});
