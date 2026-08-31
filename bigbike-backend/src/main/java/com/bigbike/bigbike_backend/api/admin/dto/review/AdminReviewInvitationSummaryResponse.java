package com.bigbike.bigbike_backend.api.admin.dto.review;

public record AdminReviewInvitationSummaryResponse(
        long pending,
        long sent,
        long failed,
        long uncertain,
        long skipped,
        long optedOut,
        int attemptedToday,
        int dailyLimit,
        boolean enabled,
        int delayDays
) {}
