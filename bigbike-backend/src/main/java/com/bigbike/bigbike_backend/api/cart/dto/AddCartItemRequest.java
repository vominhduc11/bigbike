package com.bigbike.bigbike_backend.api.cart.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record AddCartItemRequest(
        @NotBlank String productId,
        String productVariantId,
        @Min(1) int quantity
) {}
