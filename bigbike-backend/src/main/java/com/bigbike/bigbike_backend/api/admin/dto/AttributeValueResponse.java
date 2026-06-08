package com.bigbike.bigbike_backend.api.admin.dto;

public record AttributeValueResponse(
        String id,
        String attributeId,
        String slug,
        String label,
        String labelEn,
        int sortOrder
) {}
