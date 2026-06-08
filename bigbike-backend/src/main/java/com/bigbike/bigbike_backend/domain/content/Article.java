package com.bigbike.bigbike_backend.domain.content;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SeoMeta;
import java.time.Instant;
import java.util.List;

public record Article(
        String id,
        String slug,
        String title,
        String excerpt,
        String body,
        ImageAsset coverImage,
        /** ACF product_image overlay for the Experience Carousel (re-added V171). Null when not set. */
        ImageAsset productImage,
        ContentCategorySummary category,
        List<ContentCategorySummary> categories,
        PublishStatus publishStatus,
        SeoMeta seo,
        /** Non-null only on admin detail reads (V138). Null on public/list reads. */
        ArticleTranslations translations,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt,
        /** Structured body blocks (V140). Non-null only on admin detail reads; null on public/list reads. */
        List<DescriptionBlock> bodyBlocks
) {
}
