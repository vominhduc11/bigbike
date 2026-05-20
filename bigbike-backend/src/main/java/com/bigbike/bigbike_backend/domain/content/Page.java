package com.bigbike.bigbike_backend.domain.content;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SeoMeta;
import java.time.Instant;
import java.util.List;

public record Page(
        String id,
        String slug,
        String title,
        String body,
        PageType type,
        String parentId,
        PublishStatus publishStatus,
        SeoMeta seo,
        String heroImageUrl,
        String heroImageAlt,
        String heroTitle,
        String heroDescription,
        String heroKicker,
        /** Non-null only on admin detail reads (V138). Null on public/list reads. */
        PageTranslations translations,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt,
        /** Structured body blocks (V140). Non-null only on admin detail reads; null on public/list reads. */
        List<DescriptionBlock> bodyBlocks
) {
}
