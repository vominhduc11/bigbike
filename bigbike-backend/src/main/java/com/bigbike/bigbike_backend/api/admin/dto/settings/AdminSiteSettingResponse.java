package com.bigbike.bigbike_backend.api.admin.dto.settings;

import java.time.Instant;
import java.util.UUID;

public record AdminSiteSettingResponse(
        UUID id,
        String settingKey,
        String settingValue,
        String settingGroup,
        boolean isPublic,
        String description,
        Instant createdAt,
        Instant updatedAt,
        String valueType,
        boolean sensitive,
        boolean masked
) {}
