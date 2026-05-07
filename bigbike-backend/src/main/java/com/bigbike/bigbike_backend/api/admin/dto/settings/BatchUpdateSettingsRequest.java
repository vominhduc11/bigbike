package com.bigbike.bigbike_backend.api.admin.dto.settings;

import java.util.List;

public record BatchUpdateSettingsRequest(
        List<BatchSettingUpdate> updates
) {
    public record BatchSettingUpdate(String key, String value) {}
}
