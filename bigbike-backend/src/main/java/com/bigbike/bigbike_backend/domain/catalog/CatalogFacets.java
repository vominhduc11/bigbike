package com.bigbike.bigbike_backend.domain.catalog;

import java.util.List;

/**
 * Aggregated product counts used by the storefront catalog filter sidebar.
 * Each bucket carries the count of published products matching that filter
 * value within the current category/search context.
 */
public record CatalogFacets(
        List<FacetBucket> categories,
        List<FacetBucket> brands,
        List<FacetBucket> colors,
        List<PriceBucket> priceBands
) {

    /** Generic facet bucket. {@code image} is only populated for brand logos. */
    public record FacetBucket(String key, String label, ImageAsset image, long count) {
    }

    /** Price-band bucket. {@code maxPrice} is null for the open-ended top band. */
    public record PriceBucket(String key, String label, Long minPrice, Long maxPrice, long count) {
    }
}
