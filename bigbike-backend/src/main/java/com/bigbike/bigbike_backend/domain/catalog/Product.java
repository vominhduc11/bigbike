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
        /** Homepage placement slot — see {@link HomepageBlock}. Never null; NONE means not pinned. */
        HomepageBlock homepageBlock,
        /** Pin priority inside the homepage block. Lower = earlier; null = end. Ignored when homepageBlock == NONE. */
        Integer homepageOrder,
        /** Denormalized cache of the approved-review average used by product list/detail reads. */
        java.math.BigDecimal rating,
        /** Denormalized cache of the approved-review count used by product list/detail reads. */
        Integer ratingCount,
        /** Long-form rich-HTML SEO copy rendered at the bottom of PDP. */
        String contentBottom,
        /** Rich-HTML promotion copy rendered in the PDP "Khuyến mãi" tab. */
        String promotionContent,
        /** Rich-HTML installation guide rendered in PDP section "03 Hướng dẫn lắp đặt". Detail-only. */
        String installationGuide,
        /** Product FAQ entries rendered in PDP section "05 Câu hỏi thường gặp". Detail-only. */
        List<ProductFaq> faqs,
        /**
         * Admin-curated related products shown in the PDP "Sản phẩm liên quan" section.
         * List-view shape (no nested gallery/specs/relatedProducts). Detail-only;
         * empty in list responses. Public reads include only PUBLISHED entries.
         */
        List<Product> relatedProducts,
        SeoMeta seo,
        Instant createdAt,
        Instant updatedAt
) {
}
