package com.bigbike.bigbike_backend.api.admin.dto.menu;

import java.util.UUID;

public record PublicMenuItemResponse(
        UUID id,
        UUID parentId,
        String label,
        String url,
        int sortOrder,
        boolean openInNewTab,
        String cssClass,
        /** Resolved icon URL for this menu item. Null for non-category items.
         *  Resolved from the category in the URL → CategoryEntity.menuIconUrl (DB-driven, V213). */
        String iconUrl
) {}
