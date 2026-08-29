package com.bigbike.bigbike_backend.domain.catalog;

import java.time.Instant;

public record Category(
        String id,
        String slug,
        /** Optional English URL slug (V213). Canonical {@code slug} stays vi; null when unset. */
        String slugEn,
        String name,
        String description,
        String parentId,
        ImageAsset image,
        ImageAsset icon,
        /** Legacy menu icon URL retained for compatibility; active menu icons come from {@code image}. CATEGORY_RULE_010. */
        String menuIconUrl,
        ImageAsset bannerImage,
        SeoMeta seo,
        boolean isVisible,
        boolean deleted,
        Boolean showOnHomepage,
        Integer sortOrder,
        /** Khối giới thiệu hiển thị ở ĐẦU trang danh mục (cột intro_content, đổi từ content_bottom — V290). */
        String introContent,
        /** Raw English content — non-null only on admin detail reads (V137). */
        CategoryTranslations translations,
        Instant createdAt,
        Instant updatedAt
) {
}
