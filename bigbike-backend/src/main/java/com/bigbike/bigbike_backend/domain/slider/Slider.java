package com.bigbike.bigbike_backend.domain.slider;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import java.time.Instant;

public record Slider(
        String id,
        Integer sortOrder,
        String location,
        boolean isActive,
        ImageAsset desktopImage,
        ImageAsset mobileImage,
        String productId,
        String externalLink,
        String productLink,
        String link,
        Product product,
        Instant createdAt,
        Instant updatedAt
) {
}
