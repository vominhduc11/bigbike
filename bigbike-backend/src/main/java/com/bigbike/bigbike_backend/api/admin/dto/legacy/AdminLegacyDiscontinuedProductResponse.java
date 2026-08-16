package com.bigbike.bigbike_backend.api.admin.dto.legacy;

import java.time.Instant;
import java.util.UUID;

public record AdminLegacyDiscontinuedProductResponse(
        UUID id,
        String slug,
        String name,
        String nameEn,
        String brandName,
        String categorySlug,
        String imageUrl,
        boolean enabled,
        Instant createdAt,
        Instant updatedAt
) {}
