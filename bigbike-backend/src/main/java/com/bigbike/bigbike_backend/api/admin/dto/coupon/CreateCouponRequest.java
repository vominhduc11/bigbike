package com.bigbike.bigbike_backend.api.admin.dto.coupon;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.Instant;

public record CreateCouponRequest(
        @NotBlank String code,
        @NotBlank String name,
        String description,
        @NotBlank String discountType,
        BigDecimal amount,
        BigDecimal minimumAmount,
        BigDecimal maximumAmount,
        Integer usageLimit,
        Instant startsAt,
        Instant expiresAt,
        String status,
        String channel,
        String metadata
) {}
