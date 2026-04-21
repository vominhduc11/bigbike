package com.bigbike.bigbike_backend.api.checkout.dto;

public record CheckoutAddressRequest(
        String fullName,
        String email,
        String phone,
        String country,
        String province,
        String district,
        String ward,
        String addressLine1,
        String addressLine2
) {}
