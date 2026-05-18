package com.bigbike.bigbike_backend.api.customer.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CustomerLoginRequest(
        @NotBlank(message = "Login field is required")
        String login,

        @NotBlank(message = "Password is required")
        @Size(min = 1)
        String password,

        /** "Ghi nhớ" — when true the session is kept for 30 days instead of 1. Null = false. */
        Boolean remember
) {}
