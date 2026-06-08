package com.bigbike.bigbike_backend.api.admin.dto;

public record AttributeSummaryResponse(
        String id,
        String code,
        String name,
        String nameEn,
        String kind,
        long valueCount
) {}
