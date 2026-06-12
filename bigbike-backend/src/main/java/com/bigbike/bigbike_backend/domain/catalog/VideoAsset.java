package com.bigbike.bigbike_backend.domain.catalog;

public record VideoAsset(
        String id,
        String url,
        String title,
        ImageAsset thumbnail,
        String provider,
        /** Mô tả 2–3 câu nội dung video (V175) → caption + VideoObject.description. */
        String description
) {
}

