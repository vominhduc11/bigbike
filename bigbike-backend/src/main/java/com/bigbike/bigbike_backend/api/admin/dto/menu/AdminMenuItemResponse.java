package com.bigbike.bigbike_backend.api.admin.dto.menu;

import java.time.Instant;
import java.util.UUID;

public record AdminMenuItemResponse(
        UUID id,
        UUID menuId,
        UUID parentId,
        String label,
        /** Raw English label (V160), no fallback. Null when no English label set. For the admin editor. */
        String labelEn,
        String url,
        String targetType,
        String targetId,
        int sortOrder,
        boolean openInNewTab,
        String cssClass,
        String status,
        Instant createdAt,
        Instant updatedAt
) {}
