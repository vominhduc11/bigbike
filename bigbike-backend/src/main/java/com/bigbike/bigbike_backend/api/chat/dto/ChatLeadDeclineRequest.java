package com.bigbike.bigbike_backend.api.chat.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record ChatLeadDeclineRequest(
        @NotNull UUID conversationId,
        @Size(max = 128) String visitorToken
) {
    public ChatLeadDeclineRequest(UUID conversationId) {
        this(conversationId, null);
    }
}
