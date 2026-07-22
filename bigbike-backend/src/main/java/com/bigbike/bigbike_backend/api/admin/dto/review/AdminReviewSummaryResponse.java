package com.bigbike.bigbike_backend.api.admin.dto.review;

import java.math.BigDecimal;
import java.util.Map;

/** Whole-system review KPIs used by the admin moderation screen. */
public record AdminReviewSummaryResponse(
        ApprovedSummary approved,
        PendingSummary pending
) {
    public record ApprovedSummary(
            BigDecimal averageRating,
            long totalReviews,
            Map<String, Long> ratingBreakdown
    ) {}

    public record PendingSummary(
            long totalReviews,
            long oneStarReviews
    ) {}
}
