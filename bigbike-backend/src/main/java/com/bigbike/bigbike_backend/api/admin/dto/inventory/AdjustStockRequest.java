package com.bigbike.bigbike_backend.api.admin.dto.inventory;

import jakarta.validation.constraints.NotNull;

public record AdjustStockRequest(
        @NotNull Integer quantityDelta,
        String movementType,
        String note
) {}
