package com.bigbike.bigbike_backend.domain.video;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import java.time.Instant;

public record HomeVideo(
        String id,
        Integer sortOrder,
        String title,
        String videoUrl,
        String youtubeId,
        ImageAsset thumbnail,
        boolean isActive,
        Instant createdAt,
        Instant updatedAt
) {
}
