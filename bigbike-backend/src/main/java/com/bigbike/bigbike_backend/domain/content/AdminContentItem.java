package com.bigbike.bigbike_backend.domain.content;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SeoMeta;
import java.time.Instant;
import java.util.List;

public record AdminContentItem(
        String id,
        String type,
        String slug,
        String title,
        String excerpt,
        String body,
        ImageAsset coverImage,
        ImageAsset productImage,
        PublishStatus publishStatus,
        SeoMeta seo,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt,
        List<String> tags,
        AuthorSummary author,
        String authorId,
        ContentCategorySummary category,
        String categoryId,
        List<ContentCategorySummary> categories,
        PageType pageType,
        String parentId
) {
}
