import { describe, expect, it } from "vitest";

import { isCurrentCatalogFacetResponse } from "@/lib/utils/catalog-facet-response";
import type { CatalogFacets } from "@/lib/contracts/public";

const facets = {} as CatalogFacets;

describe("catalog facet response freshness guard", () => {
  it("does not normalize while the debounced query is still old", () => {
    const previousQuery = { filterColor: ["do"] };
    const currentQuery = { filterColor: ["do", "den"] };

    expect(isCurrentCatalogFacetResponse(currentQuery, previousQuery, facets)).toBe(false);
  });

  it("allows normalization only after the matching facet response arrives", () => {
    const currentQuery = { filterColor: ["do", "den"] };

    expect(isCurrentCatalogFacetResponse(currentQuery, currentQuery, facets)).toBe(true);
    expect(isCurrentCatalogFacetResponse(currentQuery, currentQuery, undefined)).toBe(false);
  });
});
