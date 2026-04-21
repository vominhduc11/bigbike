package com.bigbike.bigbike_backend.api.customer.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record CustomerRegisterRequest(
        @Email(message = "Invalid email format")
        String email,

        String phone,

        @Size(min = 6, message = "Password must be at least 6 characters")
        String password,

        String displayName
) {}
