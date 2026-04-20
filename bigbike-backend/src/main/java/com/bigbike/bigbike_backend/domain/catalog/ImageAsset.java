package com.bigbike.bigbike_backend.domain.catalog;

public record ImageAsset(
        String id,
        String url,
        String alt,
        Integer width,
        Integer height,
        String mimeType
) {
}

