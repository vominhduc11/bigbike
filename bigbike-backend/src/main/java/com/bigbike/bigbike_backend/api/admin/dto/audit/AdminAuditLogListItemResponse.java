package com.bigbike.bigbike_backend.api.admin.dto.audit;

import java.time.Instant;
import java.util.UUID;

public record AdminAuditLogListItemResponse(
        UUID id,
        String actorType,
        UUID actorId,
        String actorDisplayName,
        String actorEmail,
        String action,
        String resourceType,
        UUID resourceId,
        String resourceDisplayName,
        String resourceCode,
        String beforeData,
        String afterData,
        String ipAddress,
        Instant createdAt
) {}
