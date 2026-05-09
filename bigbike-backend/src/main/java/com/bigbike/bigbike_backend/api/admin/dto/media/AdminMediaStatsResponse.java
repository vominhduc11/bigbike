package com.bigbike.bigbike_backend.api.admin.dto.media;

import java.util.Map;

/**
 * Aggregate counts for the media library, used to power the dropdown badges
 * ("Used (2.220)") and to show total filter results.
 */
public record AdminMediaStatsResponse(
        long total,
        long used,
        long unused,
        long activeCount,
        long deletedCount,
        Map<String, Long> byMimeGroup,
        long totalSizeBytes
) {}
