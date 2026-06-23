package com.bigbike.bigbike_backend.api.admin.dto.inventory;

import jakarta.validation.constraints.NotNull;

/**
 * Boolean availability toggle for the inventory model (owner decision 2026-06-23):
 * inventory is "còn hàng / hết hàng" only, no quantities.
 */
public record SetAvailabilityRequest(
        @NotNull Boolean available
) {}
