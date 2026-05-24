package com.bigbike.bigbike_backend.api.admin.dto;

public record AttributeSummaryResponse(
        String id,
        String code,
        String name,
        String kind,
        long valueCount
) {}
