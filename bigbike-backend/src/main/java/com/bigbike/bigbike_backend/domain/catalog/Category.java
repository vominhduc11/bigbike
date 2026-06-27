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
        /** Icon line đơn sắc cho menu/sidebar (mask-image). Khác `icon` (ảnh hero, WP "image_left"). V213. */
        String menuIconUrl,
        ImageAsset bannerImage,
        ImageAsset mobileBannerImage,
        SeoMeta seo,
        boolean isVisible,
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
