package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.Instant;
import java.util.UUID;

public record AdminChatUnansweredResponse(
        UUID conversationId,
        UUID assistantMessageId,
        String customerQuestion,
        String reason,
        Instant createdAt
) {}
