package com.bigbike.bigbike_backend.api.admin.dto.coupon;

import java.math.BigDecimal;
import java.time.Instant;

public record UpdateCouponRequest(
        String code,
        String name,
        String description,
        String discountType,
        BigDecimal amount,
        BigDecimal minimumAmount,
        BigDecimal maximumAmount,
        Integer usageLimit,
        Instant startsAt,
        Instant expiresAt,
        String status,
        String metadata
) {}
