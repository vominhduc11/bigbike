package com.bigbike.bigbike_backend.api.admin.dto.customer;

import jakarta.validation.constraints.NotBlank;

public record UpdateCustomerStatusRequest(
        @NotBlank String status,
        String reason
) {}
