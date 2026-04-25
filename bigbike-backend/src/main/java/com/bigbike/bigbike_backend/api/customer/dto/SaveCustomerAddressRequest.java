package com.bigbike.bigbike_backend.api.customer.dto;

public record SaveCustomerAddressRequest(
        String type,
        String fullName,
        String phone,
        String province,
        String district,
        String ward,
        String addressLine1,
        String addressLine2,
        Boolean isDefault
) {}
