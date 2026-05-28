package com.bigbike.bigbike_backend.domain.catalog;

public record SeoMeta(
        String title,
        String description,
        String canonicalUrl,
        ImageAsset ogImage
) {
}

