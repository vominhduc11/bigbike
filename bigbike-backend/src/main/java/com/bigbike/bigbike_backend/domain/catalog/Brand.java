package com.bigbike.bigbike_backend.domain.catalog;

import java.time.Instant;

public record Brand(
        String id,
        String slug,
        String name,
        String description,
        ImageAsset logo,
        ImageAsset bannerImage,
        SeoMeta seo,
        boolean isVisible,
        Instant createdAt,
        Instant updatedAt
) {
}

