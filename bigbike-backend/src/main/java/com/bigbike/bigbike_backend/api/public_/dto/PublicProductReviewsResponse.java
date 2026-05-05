package com.bigbike.bigbike_backend.api.public_.dto;

import com.bigbike.bigbike_backend.api.common.PaginationMeta;
import java.util.List;

public record PublicProductReviewsResponse(
        double avgRating,
        long totalReviews,
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
