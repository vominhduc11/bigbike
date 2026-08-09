package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.Instant;
import java.util.UUID;

public record AdminChatMessageResponse(
        UUID id,
        String role,
        String content,
        String source,
        boolean aiCalled,
        String productsJson,
        Instant createdAt
) {}
