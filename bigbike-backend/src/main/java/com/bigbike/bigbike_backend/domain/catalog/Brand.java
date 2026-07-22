package com.bigbike.bigbike_backend.domain.catalog;

import java.time.Instant;

public record Brand(
        String id,
        String slug,
        /** Legacy-only; brand URL uses shared {@code slug} across VI/EN (BRAND_RULE_003). */
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

