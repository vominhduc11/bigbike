import type { CatalogFacets } from "@/lib/contracts/public";

/**
 * A facet response is safe for URL normalization only after the debounced
 * request represents the current filter state and that request has returned.
 */
export function isCurrentCatalogFacetResponse(
  currentQuery: unknown,
  debouncedQuery: unknown,
  facets: CatalogFacets | null | undefined,
): facets is CatalogFacets {
  return facets != null && JSON.stringify(currentQuery) === JSON.stringify(debouncedQuery);
}
