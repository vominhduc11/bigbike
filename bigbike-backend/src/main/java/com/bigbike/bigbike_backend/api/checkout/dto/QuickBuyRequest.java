package com.bigbike.bigbike_backend.api.checkout.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record QuickBuyRequest(
        @NotBlank String productId,
        String productVariantId,
        @Min(1) int quantity,
        @NotNull @Valid CheckoutAddressRequest billingAddress,
        String shippingMethodId,
        @NotBlank String paymentMethod,
        String customerNote
) {}
