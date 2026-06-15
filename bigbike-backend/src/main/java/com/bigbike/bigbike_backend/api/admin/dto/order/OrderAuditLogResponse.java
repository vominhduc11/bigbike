package com.bigbike.bigbike_backend.api.admin.dto.order;

import java.time.Instant;
import java.util.UUID;

/**
 * Read-only audit-trail entry for an order (status / payment / fulfillment / note
 * changes). Sourced from {@code audit_logs} where {@code resource_type = 'ORDER'}.
 */
public record OrderAuditLogResponse(
        UUID id,
        String action,
        String actorType,
        UUID actorId,
        String beforeData,
        String afterData,
        String ipAddress,
        Instant createdAt
) {}
