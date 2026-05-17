package com.bigbike.bigbike_backend.api.admin.dto.settings;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record BatchUpdateSettingsRequest(
        @Size(max = 200)
        List<@Valid BatchSettingUpdate> updates
) {
    public record BatchSettingUpdate(
            @NotBlank @Size(max = 191) String key,
            @Size(max = 50000) String value
    ) {}
}
