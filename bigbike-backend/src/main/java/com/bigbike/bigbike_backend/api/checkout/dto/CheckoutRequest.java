package com.bigbike.bigbike_backend.api.checkout.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CheckoutRequest(
        @NotNull @Valid CheckoutAddressRequest billingAddress,
        CheckoutShippingAddressRequest shippingAddress,
        String shippingMethodId,
        @NotBlank String paymentMethod,
        String customerNote
) {}
