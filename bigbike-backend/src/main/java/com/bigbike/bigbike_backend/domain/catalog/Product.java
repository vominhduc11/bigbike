package com.bigbike.bigbike_backend.domain.catalog;

import java.time.Instant;
import java.util.List;

public record Product(
        String id,
        String sku,
        String slug,
        String name,
        String shortDescription,
        String description,
        BrandSummary brand,
        CategorySummary category,
        List<CategorySummary> categories,
        ImageAsset image,
        List<ImageAsset> gallery,
        List<VideoAsset> videos,
        ProductPrice price,
        List<ProductVariant> variants,
        List<ProductSpecification> specifications,
        ProductStockState stockState,
        /** Best-effort on-hand count (product-level). Null if not tracked. */
        Integer stockQuantity,
        Boolean forceOutOfStock,
        PublishStatus publishStatus,
        Boolean isFeatured,
        Boolean showOnHomepage,
        java.math.BigDecimal rating,
        /** Manual review count carried over from the legacy WP ACF field. */
        Integer ratingCount,
        /** Long-form rich-HTML SEO copy rendered at the bottom of PDP. */
        String contentBottom,
        SeoMeta seo,
        Instant createdAt,
        Instant updatedAt
) {
}
