package com.bigbike.bigbike_backend.api.admin.dto.media;

import java.time.Instant;
import java.util.UUID;

public record MediaFolderResponse(
        UUID id,
        String name,
        String slug,
        UUID parentId,
        int depth,
        String systemKey,
        int sortOrder,
        String description,
        long mediaCount,
        Instant createdAt,
        Instant updatedAt
) {}
