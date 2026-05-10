package com.bigbike.bigbike_backend.api.admin.dto.inventory;

import jakarta.validation.constraints.NotBlank;

public record UpdateSerialStatusRequest(
        @NotBlank String status,
        String note
) {}
