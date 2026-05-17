package com.bigbike.bigbike_backend.api.admin.dto.menu;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record UpdateMenuItemRequest(
        UUID parentId,
        Boolean clearParentId,
        @Size(max = 255)
        String label,
        @Size(max = 2048)
        String url,
        @Size(max = 64)
        String targetType,
        UUID targetId,
        @Min(0)
        Integer sortOrder,
        Boolean openInNewTab,
        @Size(max = 255)
        String cssClass,
        @Size(max = 32)
        String status
) {}
