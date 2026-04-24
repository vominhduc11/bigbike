package com.bigbike.bigbike_backend.api.customer.dto;

import jakarta.validation.constraints.NotBlank;

public record CustomerForgotPasswordRequest(
        @NotBlank(message = "Login is required")
        String login
) {}
