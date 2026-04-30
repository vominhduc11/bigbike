package com.bigbike.bigbike_backend.api.customer.dto;

public record UpdateCustomerProfileRequest(
        String displayName,
        String phone,
        String email,
        String currentPassword,
        String newPassword,
        String gender,
        String dob
) {}
