package com.bigbike.bigbike_backend.api.admin.dto.coupon;

import jakarta.validation.constraints.NotBlank;

public record UpdateCouponStatusRequest(
        @NotBlank String status
) {}
