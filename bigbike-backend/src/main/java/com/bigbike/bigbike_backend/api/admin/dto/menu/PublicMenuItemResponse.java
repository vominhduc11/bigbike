package com.bigbike.bigbike_backend.api.admin.dto.menu;

import java.util.UUID;

public record PublicMenuItemResponse(
        UUID id,
        UUID parentId,
        String label,
        String url,
        int sortOrder,
        boolean openInNewTab,
        String cssClass
) {}
