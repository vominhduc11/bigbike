package com.bigbike.bigbike_backend.api.admin.dto.menu;

import java.util.UUID;

public record UpdateMenuItemRequest(
        UUID parentId,
        Boolean clearParentId,
        String label,
        String url,
        String targetType,
        UUID targetId,
        Integer sortOrder,
        Boolean openInNewTab,
        String cssClass,
        String status
) {}
