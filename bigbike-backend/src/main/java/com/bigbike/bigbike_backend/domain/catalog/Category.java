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
        ImageAsset bannerImage,
        ImageAsset mobileBannerImage,
        SeoMeta seo,
        boolean isVisible,
        Boolean showOnHomepage,
        Integer sortOrder,
        /** Raw English content — non-null only on admin detail reads (V137). */
        CategoryTranslations translations,
        Instant createdAt,
        Instant updatedAt
) {
}
