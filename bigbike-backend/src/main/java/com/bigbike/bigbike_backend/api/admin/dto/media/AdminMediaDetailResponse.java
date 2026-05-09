package com.bigbike.bigbike_backend.api.admin.dto.media;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AdminMediaDetailResponse(
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
        String sizes,
        String status,
        Instant createdAt,
        Instant updatedAt,
        int usageCount,
        List<MediaReferenceItem> references,
        UUID folderId,
        List<String> tags
) {}
