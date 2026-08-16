package com.bigbike.bigbike_backend.api.admin.dto.redirect;

import java.time.Instant;
import java.util.UUID;

public record AdminRedirectResponse(
        UUID id,
        String sourcePattern,
        String targetUrl,
        int statusCode,
        boolean enabled,
        long hitCount,
        Instant lastHitAt,
        Instant createdAt,
        Instant updatedAt
) {}
