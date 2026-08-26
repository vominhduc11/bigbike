package com.bigbike.bigbike_backend.api.admin.dto.maintenance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * @param state       NORMAL | ACTIVE — validated by {@code MaintenanceService.normalizedState}.
 * @param staffNote   optional message shown to staff on the maintenance overlay.
 */
public record UpdateMaintenanceRequest(
        @NotBlank String state,
        @Size(max = 2000) String staffNote
) {}
