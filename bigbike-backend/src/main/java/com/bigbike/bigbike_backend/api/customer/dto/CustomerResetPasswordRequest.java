package com.bigbike.bigbike_backend.api.customer.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CustomerResetPasswordRequest(
        @NotBlank(message = "Reset token is required")
        String token,

        @NotBlank(message = "Password is required")
        @Size(min = 8, max = 256, message = "Password must be at least 8 characters")
        String password
) {}
