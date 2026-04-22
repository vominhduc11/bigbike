package com.bigbike.bigbike_backend.api.admin.dto.customer;

import java.util.UUID;

public record AdminCustomerAddressResponse(
        UUID id,
        String type,
        String fullName,
        String phone,
        String country,
        String province,
        String district,
        String ward,
        String addressLine1,
        String addressLine2,
        boolean isDefault
) {}
