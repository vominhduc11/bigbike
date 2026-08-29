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
        /** Resolved level-1 category image URL used as the header-menu mask. Null for non-category,
         * child-category, missing-category or missing-image items (CATEGORY_RULE_011). */
        String iconUrl
) {}
