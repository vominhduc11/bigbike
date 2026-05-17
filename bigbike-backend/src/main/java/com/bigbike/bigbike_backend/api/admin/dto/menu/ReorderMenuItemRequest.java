package com.bigbike.bigbike_backend.api.admin.dto.menu;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record ReorderMenuItemRequest(
        @NotNull
        UUID id,
        UUID parentId,
        @Min(0)
        int sortOrder
) {}
