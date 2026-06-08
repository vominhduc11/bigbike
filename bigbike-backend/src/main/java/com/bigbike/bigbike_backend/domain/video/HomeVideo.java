package com.bigbike.bigbike_backend.domain.video;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import java.time.Instant;

public record HomeVideo(
        String id,
        Integer sortOrder,
        String title,
        /** Raw English title (V161), no fallback. Null when unset. For the admin editor; public reads localize {@code title}. */
        String titleEn,
        String videoUrl,
        String youtubeId,
        ImageAsset thumbnail,
        boolean isActive,
        Instant createdAt,
        Instant updatedAt
) {
}
