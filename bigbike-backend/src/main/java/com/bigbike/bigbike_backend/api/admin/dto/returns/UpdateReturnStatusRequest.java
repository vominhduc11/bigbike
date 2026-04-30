package com.bigbike.bigbike_backend.api.admin.dto.returns;

import jakarta.validation.constraints.NotBlank;

public record UpdateReturnStatusRequest(
        @NotBlank String status,
        String adminNote,
        java.math.BigDecimal refundAmount
) {}
