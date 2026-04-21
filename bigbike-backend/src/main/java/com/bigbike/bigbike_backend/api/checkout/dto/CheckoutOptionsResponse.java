package com.bigbike.bigbike_backend.api.checkout.dto;

import java.util.List;

public record CheckoutOptionsResponse(
        List<PaymentMethodOptionResponse> paymentMethods,
        List<ShippingMethodOptionResponse> shippingMethods
) {}
