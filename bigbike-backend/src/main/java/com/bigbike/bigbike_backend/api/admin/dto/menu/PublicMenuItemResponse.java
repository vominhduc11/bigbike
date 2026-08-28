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
        /** Resolved root-category header-menu icon URL. Null for non-category items and child categories.
         *  Resolved from the category in the URL → CategoryEntity.menuIconUrl (DB-driven, V213/CATEGORY_RULE_010). */
        String iconUrl
) {}
