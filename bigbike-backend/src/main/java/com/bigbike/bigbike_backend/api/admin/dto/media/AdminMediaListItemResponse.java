package com.bigbike.bigbike_backend.api.admin.dto.media;

import java.time.Instant;
import java.util.UUID;

public record AdminMediaListItemResponse(
        UUID id,
        Long legacyId,
        String filePath,
        String publicUrl,
        String storageProvider,
        String mimeType,
        Long fileSize,
        Integer width,
        Integer height,
        String altText,
        String title,
        String caption,
        String status,
        Instant createdAt,
        Instant updatedAt
) {}
