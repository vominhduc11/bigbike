package com.bigbike.bigbike_backend.api.public_.dto;

import com.bigbike.bigbike_backend.api.common.PaginationMeta;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record PublicProductReviewsResponse(
        double avgRating,
        long totalReviews,
        /** Approved-review count keyed by half-star level ("5".."1", step 0.5 — REVIEW_RULE_008) — every key always present. */
        Map<String, Long> ratingBreakdown,
        List<ReviewItem> reviews,
        PaginationMeta pagination
) {
    public record ReviewItem(
            Long id,
            String authorName,
            BigDecimal rating,
            String comment,
            List<String> photos,
            String createdAt,
            String authorAvatarUrl
    ) {
    }
}
