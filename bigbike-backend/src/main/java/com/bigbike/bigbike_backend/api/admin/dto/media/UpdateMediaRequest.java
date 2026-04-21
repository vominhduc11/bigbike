package com.bigbike.bigbike_backend.api.admin.dto.media;

public record UpdateMediaRequest(
        String altText,
        String title,
        String caption,
        String status
) {}
