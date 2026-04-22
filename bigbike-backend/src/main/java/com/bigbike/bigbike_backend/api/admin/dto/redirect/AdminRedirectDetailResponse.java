package com.bigbike.bigbike_backend.api.admin.dto.redirect;

import java.time.Instant;
import java.util.UUID;

public record AdminRedirectDetailResponse(
        UUID id,
        Long legacyId,
        String sourcePattern,
        String targetUrl,
        String redirectType,
        int statusCode,
        boolean enabled,
        long hitCount,
        Instant lastHitAt,
        String notes,
        Instant createdAt,
        Instant updatedAt
) {}
