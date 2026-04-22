package com.bigbike.bigbike_backend.api.admin.dto.menu;

import java.time.Instant;
import java.util.UUID;

public record AdminMenuItemResponse(
        UUID id,
        UUID menuId,
        UUID parentId,
        String label,
        String url,
        String targetType,
        UUID targetId,
        int sortOrder,
        boolean openInNewTab,
        String cssClass,
        String status,
        Instant createdAt,
        Instant updatedAt
) {}
