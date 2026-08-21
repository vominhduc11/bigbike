package com.bigbike.bigbike_backend.domain.catalog;

import java.time.LocalDate;

public record VideoAsset(
        String id,
        String url,
        String title,
        String titleEn,
        ImageAsset thumbnail,
        String provider,
        /** Mô tả 2–3 câu nội dung video (V175) → caption + VideoObject.description. */
        String description,
        String descriptionEn,
        Integer durationSeconds,
        LocalDate uploadedOn
) {
    /** Read compatibility for JSON written before bilingual video metadata (V1049). */
    public VideoAsset(
            String id, String url, String title, ImageAsset thumbnail, String provider, String description) {
        this(id, url, title, null, thumbnail, provider, description, null, null, null);
    }
}

