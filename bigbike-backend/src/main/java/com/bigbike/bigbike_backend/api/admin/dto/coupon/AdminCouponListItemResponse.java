package com.bigbike.bigbike_backend.api.admin.dto.coupon;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record AdminCouponListItemResponse(
        UUID id,
        String code,
        String name,
        String discountType,
        BigDecimal amount,
        BigDecimal minimumAmount,
        BigDecimal maximumAmount,
        String status,
        int usageCount,
        Integer usageLimit,
        Instant expiresAt,
        Instant createdAt
) {}
