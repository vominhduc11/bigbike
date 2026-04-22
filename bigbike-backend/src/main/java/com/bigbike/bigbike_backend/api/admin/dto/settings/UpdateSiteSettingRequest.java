package com.bigbike.bigbike_backend.api.admin.dto.settings;

public record UpdateSiteSettingRequest(
        String value,
        String group,
        Boolean isPublic,
        String description
) {}
