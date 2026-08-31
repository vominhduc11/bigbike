package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.Instant;
import java.util.UUID;

/** Compact read-only operational summary: no handoff, lead or provider telemetry. */
public record AdminChatConversationResponse(
        UUID id,
        String locale,
        String customerDisplayName,
        int turnCount,
        int aiCallCount,
        String lastResultKind,
        Instant startedAt,
        Instant lastMessageAt,
        String endedReason
) {}
