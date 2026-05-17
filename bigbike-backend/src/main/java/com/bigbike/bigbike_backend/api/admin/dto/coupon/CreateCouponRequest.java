package com.bigbike.bigbike_backend.api.admin.dto.coupon;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;

public record CreateCouponRequest(
        @NotBlank @Size(max = 64) String code,
        @NotBlank @Size(max = 255) String name,
        @Size(max = 2000)
        String description,
        @NotBlank @Size(max = 32) String discountType,
        @DecimalMin(value = "0.00", inclusive = false)
        BigDecimal amount,
        @DecimalMin(value = "0.00")
        BigDecimal minimumAmount,
        @DecimalMin(value = "0.00")
        BigDecimal maximumAmount,
        @Min(1)
        Integer usageLimit,
        Instant startsAt,
        Instant expiresAt,
        @Size(max = 32)
        String status,
        @Size(max = 16)
        String channel,
        @Size(max = 5000)
        String metadata
) {}
