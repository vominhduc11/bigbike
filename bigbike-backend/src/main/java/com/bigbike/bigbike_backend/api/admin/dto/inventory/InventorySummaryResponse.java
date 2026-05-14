package com.bigbike.bigbike_backend.api.admin.dto.inventory;

public record InventorySummaryResponse(
        long totalItems,
        long outOfStockCount,
        long lowStockCount
) {}
