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
        /** Pin priority inside homepage featured/showOnHomepage blocks. Lower = earlier; null = end. */
        Integer homepageOrder,
        /** Denormalized cache of the approved-review average used by product list/detail reads. */
        java.math.BigDecimal rating,
        /** Denormalized cache of the approved-review count used by product list/detail reads. */
        Integer ratingCount,
        /** Long-form rich-HTML SEO copy rendered at the bottom of PDP. */
        String contentBottom,
        SeoMeta seo,
        Instant createdAt,
        Instant updatedAt
) {
}
