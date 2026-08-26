package com.bigbike.bigbike_backend.service.maintenance;

import java.time.Instant;

/**
 * Admin-panel maintenance state, as broadcast over STOMP and served by the admin API.
 *
 * <p>Carries no storefront concern: customers are never affected by maintenance
 * (BUSINESS_RULES {@code MAINTENANCE_RULE_001}/{@code _002}).
 */
public record MaintenanceStatus(
        String state,
        String staffNote,
        Instant updatedAt
) {}
