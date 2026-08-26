package com.bigbike.bigbike_backend.api.chat.dto;

import java.time.Instant;
import java.util.UUID;

public record ChatImageResponse(
        UUID id,
        String contentPath,
        String mimeType,
        int width,
        int height,
        long sizeBytes,
        String status,
        Instant createdAt
) {}
