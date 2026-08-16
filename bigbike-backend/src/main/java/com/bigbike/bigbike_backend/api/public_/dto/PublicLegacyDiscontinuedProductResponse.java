package com.bigbike.bigbike_backend.api.public_.dto;

public record PublicLegacyDiscontinuedProductResponse(
        String slug,
        String name,
        String brandName,
        String categorySlug,
        String imageUrl,
        boolean enabled
) {}
