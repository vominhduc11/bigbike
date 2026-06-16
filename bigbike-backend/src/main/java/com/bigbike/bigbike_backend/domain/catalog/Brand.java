package com.bigbike.bigbike_backend.domain.catalog;

import java.time.Instant;

public record Brand(
        String id,
        String slug,
        /** Optional English URL slug (V215). Canonical {@code slug} stays vi; null when unset. */
        String slugEn,
        String name,
        String description,
        ImageAsset logo,
        ImageAsset bannerImage,
        ImageAsset mobileBannerImage,
        SeoMeta seo,
        boolean isVisible,
        /** Raw English content — non-null only on admin detail reads (V137). */
        BrandTranslations translations,
        Instant createdAt,
        Instant updatedAt
) {
}

