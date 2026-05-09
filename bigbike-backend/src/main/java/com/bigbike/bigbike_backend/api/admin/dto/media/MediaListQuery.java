package com.bigbike.bigbike_backend.api.admin.dto.media;

import java.time.Instant;
import java.util.UUID;

/**
 * All query parameters accepted by GET /admin/media. Bundled into a record so
 * the service signature stays compact as filters grow.
 *
 * <p>folderFilter semantics:
 * <ul>
 *   <li>{@code null} or empty → no folder filter (show everything matching other filters)</li>
 *   <li>{@code "NONE"} → only items not in any folder ("uncategorized")</li>
 *   <li>any UUID → only items in that folder</li>
 * </ul>
 */
public record MediaListQuery(
        int page,
        int size,
        String q,
        String mimeType,
        String status,
        String storageProvider,
        String usageFilter,
        Instant uploadedFrom,
        Instant uploadedTo,
        Long minSize,
        Long maxSize,
        Integer minWidth,
        Integer minHeight,
        String sort,
        String dir,
        String folderFilter,  // "NONE" | UUID string | null
        String tag            // single tag string | null
) {}
