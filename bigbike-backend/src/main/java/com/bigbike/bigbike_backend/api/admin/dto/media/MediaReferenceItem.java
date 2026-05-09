package com.bigbike.bigbike_backend.api.admin.dto.media;

public record MediaReferenceItem(
        String type,
        String id,
        String name,
        String adminPath
) {}
