package com.bigbike.bigbike_backend.api.admin.dto.order;

import java.time.Instant;
import java.util.UUID;

public record AdminOrderNoteResponse(
        UUID id,
        String authorType,
        UUID authorId,
        String noteType,
        String content,
        boolean customerVisible,
        Instant createdAt
) {}
