package com.bigbike.bigbike_backend.api.chat.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * CHAT_RULE_049 (owner decision 2026-09-05): the assistant only remembers inside the open browser
 * session, so there is no memory switch to send any more.
 */
public record ChatSessionRequest(
        @NotNull UUID visitorId,
        @Size(max = 128) String visitorToken,
        @Pattern(regexp = "^(vi|en)$") String locale
) {}
