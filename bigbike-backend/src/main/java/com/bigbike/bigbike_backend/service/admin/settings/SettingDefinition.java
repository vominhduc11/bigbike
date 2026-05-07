package com.bigbike.bigbike_backend.service.admin.settings;

import java.math.BigDecimal;
import java.util.Set;

public record SettingDefinition(
        String key,
        String group,
        SettingValueType type,
        boolean publicAllowed,
        boolean sensitive,
        boolean editable,
        boolean required,
        Set<String> allowedValues,
        BigDecimal min,
        BigDecimal max,
        String description
) {
    public static Builder builder(String key, String group, SettingValueType type) {
        return new Builder(key, group, type);
    }

    public static final class Builder {
        private final String key;
        private final String group;
        private final SettingValueType type;
        private boolean publicAllowed = false;
        private boolean sensitive = false;
        private boolean editable = true;
        private boolean required = false;
        private Set<String> allowedValues = Set.of();
        private BigDecimal min;
        private BigDecimal max;
        private String description = "";

        private Builder(String key, String group, SettingValueType type) {
            this.key = key;
            this.group = group;
            this.type = type;
        }

        public Builder publicAllowed() { this.publicAllowed = true; return this; }
        public Builder sensitive() { this.sensitive = true; return this; }
        public Builder readOnly() { this.editable = false; return this; }
        public Builder required() { this.required = true; return this; }
        public Builder allowedValues(String... values) { this.allowedValues = Set.of(values); return this; }
        public Builder min(BigDecimal v) { this.min = v; return this; }
        public Builder max(BigDecimal v) { this.max = v; return this; }
        public Builder min(long v) { this.min = BigDecimal.valueOf(v); return this; }
        public Builder max(long v) { this.max = BigDecimal.valueOf(v); return this; }
        public Builder description(String d) { this.description = d; return this; }

        public SettingDefinition build() {
            return new SettingDefinition(
                    key, group, type, publicAllowed, sensitive, editable, required,
                    allowedValues, min, max, description);
        }
    }
}
