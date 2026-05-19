package com.bigbike.bigbike_backend.api.public_.dto;

import com.bigbike.bigbike_backend.api.common.PaginationMeta;
import java.util.List;
import java.util.Map;

public record PublicProductReviewsResponse(
        double avgRating,
        long totalReviews,
        /** Approved-review count keyed by star value 1..5 — every key always present. */
        Map<Integer, Long> ratingBreakdown,
        List<ReviewItem> reviews,
        PaginationMeta pagination
) {
    public record ReviewItem(
            Long id,
            String authorName,
            int rating,
            String comment,
            String createdAt
    ) {
    }
}
