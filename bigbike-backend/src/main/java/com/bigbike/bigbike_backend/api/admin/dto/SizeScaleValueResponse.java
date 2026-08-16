package com.bigbike.bigbike_backend.api.admin.dto;

public record SizeScaleValueResponse(
        String id,
        String valueKey,
        String label,
        String labelEn,
        String subgroupKey,
        String subgroupLabel,
        String subgroupLabelEn,
        int sortOrder,
        boolean active
) {
}
