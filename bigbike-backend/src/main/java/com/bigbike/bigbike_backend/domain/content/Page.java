package com.bigbike.bigbike_backend.domain.content;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SeoMeta;
import java.time.Instant;

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
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt
) {
}
