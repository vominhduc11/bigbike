package com.bigbike.bigbike_backend.api.checkout.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CheckoutRequest(
        @NotNull @Valid CheckoutAddressRequest billingAddress,
        @Valid
        CheckoutShippingAddressRequest shippingAddress,
        // Optional (owner decision 2026-06-23): online checkout no longer asks the customer to pick a
        // payment method — the admin reconciles payment offline. Kept for backward-compatible callers.
        @Size(max = 32) String paymentMethod,
        @Size(max = 1000)
        String customerNote
) {}
