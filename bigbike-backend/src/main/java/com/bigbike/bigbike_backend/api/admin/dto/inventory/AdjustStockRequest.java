package com.bigbike.bigbike_backend.api.admin.dto.inventory;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record AdjustStockRequest(
        @NotNull Integer quantityDelta,
        @Size(max = 32)
        String movementType,
        @Size(max = 1000)
        String note,
        @Size(max = 500)
        List<@Size(max = 100) String> serialNumbers
) {}
