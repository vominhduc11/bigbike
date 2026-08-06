package com.bigbike.bigbike_backend.domain.catalog;

public record SeoMeta(
        String title,
        String description,
        String canonicalUrl,
        ImageAsset ogImage,
        /**
         * Cờ "không cho Google hiển thị", ĐÃ resolve theo locale của request (V371).
         *
         * <p>{@code lang=vi} → cờ bản tiếng Việt. {@code lang=en} → cờ bản tiếng Anh HOẶC bản EN
         * chưa đạt ngưỡng đủ nội dung. Xem {@link SeoIndexPolicy} và BUSINESS_RULES
         * {@code SEO_RULE_001}/{@code SEO_RULE_002}.
         *
         * <p>Trước V371 chỉ bài viết dùng field này; product/category/brand luôn trả false.
         */
        boolean noIndex
) {
}

