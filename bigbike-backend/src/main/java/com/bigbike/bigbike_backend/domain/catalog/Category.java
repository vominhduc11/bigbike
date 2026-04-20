package com.bigbike.bigbike_backend.domain.catalog;

import java.time.Instant;

public record Category(
        String id,
        String slug,
        String name,
        String description,
        String parentId,
        ImageAsset image,
        ImageAsset icon,
        SeoMeta seo,
        boolean isVisible,
        Integer sortOrder,
        Instant createdAt,
        Instant updatedAt
) {
}

