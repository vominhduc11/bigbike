package com.bigbike.bigbike_backend.api.admin.dto;

import java.util.List;

public record SizeScaleResponse(
        String id,
        String code,
        String name,
        String nameEn,
        SizeScaleGroupResponse group,
        String filterNamespace,
        int sortOrder,
        boolean active,
        List<SizeScaleValueResponse> values
) {
}
