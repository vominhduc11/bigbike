package com.bigbike.bigbike_backend.api.order.dto;

import java.time.Instant;
import java.util.UUID;

public record OrderNoteResponse(
        UUID id,
        String noteType,
        String content,
        Instant createdAt
) {}
