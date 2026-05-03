package com.bigbike.bigbike_backend.api.admin.dto.inventory;

import jakarta.validation.constraints.NotNull;
import java.util.List;

public record AdjustStockRequest(
        @NotNull Integer quantityDelta,
        String movementType,
        String note,
        List<String> serialNumbers
) {}
