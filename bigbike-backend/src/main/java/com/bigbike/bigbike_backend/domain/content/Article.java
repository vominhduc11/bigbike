package com.bigbike.bigbike_backend.domain.content;

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
        ImageAsset productImage,
        AuthorSummary author,
        ContentCategorySummary category,
        List<ContentCategorySummary> categories,
        List<String> tags,
        PublishStatus publishStatus,
        SeoMeta seo,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt
) {
}
