package com.bigbike.bigbike_backend.api.order.dto;

public record OrderAddressResponse(
        String type,
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
