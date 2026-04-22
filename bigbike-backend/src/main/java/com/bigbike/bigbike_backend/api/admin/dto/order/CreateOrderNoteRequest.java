package com.bigbike.bigbike_backend.api.admin.dto.order;

import jakarta.validation.constraints.NotBlank;

public record CreateOrderNoteRequest(
        @NotBlank String content,
        Boolean customerVisible,
        String noteType
) {}
