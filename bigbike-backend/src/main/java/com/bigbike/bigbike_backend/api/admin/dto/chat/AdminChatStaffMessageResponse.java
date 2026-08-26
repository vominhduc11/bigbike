package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.Instant;
import java.util.UUID;

public record AdminChatStaffMessageResponse(
        UUID id,
        UUID conversationId,
        long sequenceNo,
        String role,
        String content,
        String staffDisplayName,
        Instant createdAt
) {}
