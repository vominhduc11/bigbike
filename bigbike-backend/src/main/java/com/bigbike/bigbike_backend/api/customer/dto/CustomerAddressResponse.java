package com.bigbike.bigbike_backend.api.customer.dto;

import java.util.UUID;

public record CustomerAddressResponse(
        UUID id,
        String type,
        String fullName,
        String phone,
        String email,
        String country,
        String province,
        String district,
        String ward,
        String addressLine1,
        String addressLine2,
        boolean isDefault
) {}
