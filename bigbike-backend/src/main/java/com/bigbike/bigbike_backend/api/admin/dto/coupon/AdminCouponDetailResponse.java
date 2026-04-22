package com.bigbike.bigbike_backend.api.admin.dto.coupon;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record AdminCouponDetailResponse(
        UUID id,
        Long legacyId,
        String code,
        String name,
        String description,
        String discountType,
        BigDecimal amount,
        BigDecimal minimumAmount,
        BigDecimal maximumAmount,
        Integer usageLimit,
        int usageCount,
        Instant startsAt,
        Instant expiresAt,
        String status,
        String metadata,
        Instant createdAt,
        Instant updatedAt
) {}
