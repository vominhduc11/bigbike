package com.bigbike.bigbike_backend.api.admin.dto.menu;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record CreateMenuItemRequest(
        UUID parentId,
        @NotBlank String label,
        String url,
        String targetType,
        UUID targetId,
        Integer sortOrder,
        Boolean openInNewTab,
        String cssClass,
        String status
) {}
