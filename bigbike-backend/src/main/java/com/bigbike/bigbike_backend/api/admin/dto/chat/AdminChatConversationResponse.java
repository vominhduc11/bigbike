package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.Instant;
import java.util.UUID;

public record AdminChatConversationResponse(
        UUID id,
        String locale,
        String customerDisplayName,
        int turnCount,
        int aiCallCount,
        boolean hasLead,
        Instant startedAt,
        Instant lastMessageAt,
        String endedReason
) {}
