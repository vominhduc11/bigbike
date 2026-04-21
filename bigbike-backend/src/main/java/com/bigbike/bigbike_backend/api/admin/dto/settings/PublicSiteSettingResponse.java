package com.bigbike.bigbike_backend.api.admin.dto.settings;

public record PublicSiteSettingResponse(
        String settingKey,
        String settingValue,
        String settingGroup
) {}
