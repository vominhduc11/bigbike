package com.bigbike.bigbike_backend.api.admin.dto.menu;

import java.util.UUID;

public record ReorderMenuItemRequest(
        UUID id,
        UUID parentId,
        int sortOrder
) {}
