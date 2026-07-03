package com.bigbike.bigbike_backend.api.admin.dto.settings;

import java.time.Instant;
import java.util.UUID;

public record AdminSiteSettingResponse(
        UUID id,
        String settingKey,
        String settingValue,
        /** Raw English value (V162), no fallback. Null for config/non-translatable keys. For the admin editor. */
        String settingValueEn,
        String settingGroup,
        boolean isPublic,
        String description,
        Instant createdAt,
        Instant updatedAt,
        String valueType,
        boolean sensitive,
        boolean masked,
        boolean superAdminOnly
) {}
