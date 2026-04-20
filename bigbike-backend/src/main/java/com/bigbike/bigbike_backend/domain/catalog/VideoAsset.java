package com.bigbike.bigbike_backend.domain.catalog;

public record VideoAsset(
        String id,
        String url,
        String title,
        ImageAsset thumbnail,
        String provider
) {
}

