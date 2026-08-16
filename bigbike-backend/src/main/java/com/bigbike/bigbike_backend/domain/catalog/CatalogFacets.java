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
        List<FacetBucket> finishes,
        FacetBucket availability,
        List<FacetBucket> genders,
        List<FacetBucket> sizes,
        List<SizeGroupFacet> sizeGroups,
        PriceRange priceRange,
        long resultCount,
        List<String> resolvedColorKeys
) {

    /** Source-compatible adapter for callers that predate visual/availability facets. */
    public CatalogFacets(
            List<FacetBucket> categories,
            List<FacetBucket> brands,
            List<FacetBucket> colors,
            List<FacetBucket> genders,
            List<FacetBucket> sizes,
            List<SizeGroupFacet> sizeGroups,
            PriceRange priceRange
    ) {
        this(categories, brands, colors, List.of(), null, genders, sizes, sizeGroups,
                priceRange, 0, List.of());
    }

    /** Generic facet bucket. Image is used by category/brand; swatch only by colors. */
    public record FacetBucket(String key, String label, ImageAsset image, String swatch, long count) {
        public FacetBucket(String key, String label, ImageAsset image, long count) {
            this(key, label, image, null, count);
        }
    }

    /** Dynamic price axis and density buckets for the current facet context. */
    public record PriceRange(
            long minPrice,
            long maxPrice,
            long step,
            List<PriceHistogramBucket> buckets
    ) {
    }

    /** Equal-width density bucket; empty buckets are retained for a stable histogram axis. */
    public record PriceHistogramBucket(long minPrice, long maxPrice, long count) {
    }

    /** Grouped size values used by the current storefront sidebar. */
    public record SizeGroupFacet(
            String key,
            String label,
            List<SizeBucket> buckets
    ) {
    }

    /** A namespaced size filter bucket; key is safe to send back as kich-co. */
    public record SizeBucket(String key, String valueKey, String label, long count) {
    }
}
