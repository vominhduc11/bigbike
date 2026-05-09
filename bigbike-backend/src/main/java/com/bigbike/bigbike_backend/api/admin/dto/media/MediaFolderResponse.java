package com.bigbike.bigbike_backend.api.admin.dto.media;

import java.time.Instant;
import java.util.UUID;

public record MediaFolderResponse(
        UUID id,
        String name,
        String slug,
        String description,
        long mediaCount,
        Instant createdAt,
        Instant updatedAt
) {}
