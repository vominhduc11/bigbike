package com.bigbike.bigbike_backend.api.admin.dto;

public record SizeScaleGroupResponse(
        String id,
        String key,
        String label,
        String labelEn,
        int sortOrder,
        boolean active
) {
}
