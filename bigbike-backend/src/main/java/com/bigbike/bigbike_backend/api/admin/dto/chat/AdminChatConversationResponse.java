package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.Instant;
import java.util.UUID;

/** Compact operational summary: no lead, attribution or provider-cost telemetry. */
public record AdminChatConversationResponse(
        UUID id,
        String locale,
        String customerDisplayName,
        int turnCount,
        int aiCallCount,
        String handoffStatus,
        String lastResultKind,
        Instant startedAt,
        Instant lastMessageAt,
        String endedReason
) {}
