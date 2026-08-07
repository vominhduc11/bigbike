package com.bigbike.bigbike_backend.api.admin.dto.redirect;

import java.time.Instant;
import java.util.UUID;

public record AdminRedirectResponse(
        UUID id,
        String sourcePattern,
        String targetUrl,
        boolean enabled,
        long hitCount,
        Instant lastHitAt,
        String notes,
        Long legacyId,
        Instant createdAt,
        Instant updatedAt
) {}
