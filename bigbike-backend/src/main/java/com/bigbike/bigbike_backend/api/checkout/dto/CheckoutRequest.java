package com.bigbike.bigbike_backend.api.checkout.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CheckoutRequest(
        @NotNull @Valid CheckoutAddressRequest billingAddress,
        @Valid
        CheckoutShippingAddressRequest shippingAddress,
        // Optional for backward-compatible callers: omitted values default to COD. New storefront
        // checkout sends the customer's COD or BANK_TRANSFER selection; reconciliation stays manual.
        @Size(max = 32) String paymentMethod,
        @Size(max = 1000)
        String customerNote
) {}
