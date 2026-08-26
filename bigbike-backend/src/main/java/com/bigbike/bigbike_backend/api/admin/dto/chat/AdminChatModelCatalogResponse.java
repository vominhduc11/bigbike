package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.Instant;
import java.util.List;

public record AdminChatModelCatalogResponse(
        String currentModel,
        String fallbackModel,
        String reviewModerationModel,
        List<AdminChatModelResponse> models,
        Instant refreshedAt,
        boolean stale
) {
    public AdminChatModelCatalogResponse {
        models = models == null ? List.of() : List.copyOf(models);
    }
}
