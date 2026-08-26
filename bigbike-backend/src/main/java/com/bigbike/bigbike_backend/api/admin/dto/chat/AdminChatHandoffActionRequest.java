package com.bigbike.bigbike_backend.api.admin.dto.chat;

import jakarta.validation.constraints.Pattern;

public record AdminChatHandoffActionRequest(
        @Pattern(regexp = "^(vi|en)$") String locale
) {
    public String safeLocale() { return "en".equals(locale) ? "en" : "vi"; }
}
