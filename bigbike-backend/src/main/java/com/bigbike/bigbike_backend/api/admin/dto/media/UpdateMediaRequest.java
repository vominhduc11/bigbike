package com.bigbike.bigbike_backend.api.admin.dto.media;

import java.util.List;
import java.util.UUID;

public record UpdateMediaRequest(
        String altText,
        String title,
        String caption,
        String status,
        UUID folderId,
        Boolean clearFolder,   // explicit "remove from folder" signal
        List<String> tags
) {}
