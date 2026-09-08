package com.bigbike.bigbike_backend.api.chat.dto;

import java.time.Instant;
import java.util.UUID;

public record ChatVideoResponse(UUID id, String status, String mimeType, long sizeBytes,
        double durationSeconds, boolean hasAudio, String contentPath, Instant createdAt,
        Instant expiresAt) {}
