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
         *  Derived from category slug in URL (legacy WP parity).
         *  TODO: replace with CategoryEntity.iconUrl lookup when category icons are populated. */
        String iconUrl
) {}
