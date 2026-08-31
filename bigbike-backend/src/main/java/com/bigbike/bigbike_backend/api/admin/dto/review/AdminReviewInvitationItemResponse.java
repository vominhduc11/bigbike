package com.bigbike.bigbike_backend.api.admin.dto.review;

import java.time.Instant;
import java.util.UUID;

public record AdminReviewInvitationItemResponse(
        UUID id,
        UUID orderId,
        String orderNumber,
        String recipientEmail,
        String locale,
        String status,
        Instant completedAt,
        Instant dueAt,
        Instant attemptedAt,
        Instant providerAcceptedAt,
        String skipReason,
        String failureCode,
        String failureMessage,
        long productCount,
        long reviewedProductCount,
        Instant createdAt
) {}
