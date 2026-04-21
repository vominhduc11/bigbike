package com.bigbike.bigbike_backend.api.admin.dto.customer;

public record UpdateCustomerRequest(
        String email,
        String phone,
        String displayName,
        String firstName,
        String lastName
) {}
