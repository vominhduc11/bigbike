package com.bigbike.bigbike_backend.api.admin.dto.order;

import jakarta.validation.constraints.NotBlank;

public record UpdateOrderStatusRequest(
        @NotBlank String status,
        String note,
        Boolean customerVisible
) {}
