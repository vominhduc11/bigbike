package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AdminChatHandoffResponse(
        UUID id,
        UUID conversationId,
        String status,
        String triggerSource,
        String customerKind,
        String questionSummary,
        List<ProductReference> products,
        Instant requestedAt,
        long waitingSeconds,
        Instant acknowledgedAt,
        UUID acknowledgedBy,
        Instant assignedAt,
        UUID assignedAdminId,
        String assignedDisplayName,
        Instant resolvedAt,
        String resolution,
        boolean withinBusinessHours,
        Instant nextOpenAt
) {
    public record ProductReference(String slug, String name) {}
}
