package com.bigbike.bigbike_backend.api.chat.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record ChatHandoffRequest(
        @NotNull UUID requestId,
        UUID conversationId,
        @NotNull @Pattern(regexp = "^(vi|en)$") String locale,
        @NotNull @Pattern(regexp = "^(BUTTON|MESSAGE)$") String trigger,
        @Size(max = 128) String visitorToken
) {
    public ChatHandoffRequest(UUID requestId, UUID conversationId, String locale, String trigger) {
        this(requestId, conversationId, locale, trigger, null);
    }
}
