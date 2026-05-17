package com.bigbike.bigbike_backend.api.admin.dto.settings;

import jakarta.validation.constraints.Size;

public record UpdateSiteSettingRequest(
        @Size(max = 50000)
        String value,
        @Size(max = 100)
        String group,
        Boolean isPublic,
        @Size(max = 1000)
        String description
) {}
