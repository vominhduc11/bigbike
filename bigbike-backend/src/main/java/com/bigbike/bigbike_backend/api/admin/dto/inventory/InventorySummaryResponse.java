package com.bigbike.bigbike_backend.api.admin.dto.inventory;

public record InventorySummaryResponse(
        long totalVariants,
        long outOfStockCount,
        long lowStockCount
) {}
