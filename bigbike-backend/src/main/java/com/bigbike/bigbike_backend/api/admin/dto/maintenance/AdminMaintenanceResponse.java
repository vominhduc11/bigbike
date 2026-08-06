package com.bigbike.bigbike_backend.api.admin.dto.maintenance;

import java.time.Instant;

/**
 * Maintenance state as served to the admin panel.
 *
 * @param canToggle   whether THIS caller may change the state (DEVELOPER role only). Lets the
 *                    frontend gate nav and buttons without re-deriving the role rule.
 * @param uploadCount in-flight admin uploads, surfaced in the "lock now" confirm dialog so a
 *                    developer does not cut off a large media upload mid-flight.
 */
public record AdminMaintenanceResponse(
        String state,
        String staffNote,
        Instant expectedAt,
        Instant updatedAt,
        boolean canToggle,
        int uploadCount
) {}
