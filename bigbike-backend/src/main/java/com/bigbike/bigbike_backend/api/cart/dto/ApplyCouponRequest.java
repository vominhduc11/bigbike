package com.bigbike.bigbike_backend.api.cart.dto;

import jakarta.validation.constraints.NotBlank;

public record ApplyCouponRequest(
        @NotBlank String code
) {}
