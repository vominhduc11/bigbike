package com.bigbike.bigbike_backend.api.checkout.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record QuickBuyRequest(
        @NotBlank @Size(max = 64) String productId,
        @Size(max = 64)
        String productVariantId,
        @Min(1) int quantity,
        @NotNull @Valid CheckoutAddressRequest billingAddress,
        // Optional (owner decision 2026-06-23) — see CheckoutRequest#paymentMethod.
        @Size(max = 32) String paymentMethod,
        @Size(max = 1000)
        String customerNote
) {}
