package com.bigbike.bigbike_backend.api.chat.dto;

import java.time.Instant;
import java.util.UUID;

public record ChatInteractionResponse(
        boolean recorded,
        UUID interactionId,
        String attributionToken,
        Instant attributionExpiresAt
) {
    public ChatInteractionResponse(boolean recorded, UUID interactionId) {
        this(recorded, interactionId, null, null);
    }
}
