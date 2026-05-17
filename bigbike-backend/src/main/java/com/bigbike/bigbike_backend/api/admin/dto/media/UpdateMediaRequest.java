package com.bigbike.bigbike_backend.api.admin.dto.media;

import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record UpdateMediaRequest(
        @Size(max = 255)
        String altText,
        @Size(max = 255)
        String title,
        @Size(max = 2000)
        String caption,
        @Size(max = 32)
        String status,
        UUID folderId,
        Boolean clearFolder,   // explicit "remove from folder" signal
        @Size(max = 50)
        List<@Size(max = 64) String> tags
) {}
