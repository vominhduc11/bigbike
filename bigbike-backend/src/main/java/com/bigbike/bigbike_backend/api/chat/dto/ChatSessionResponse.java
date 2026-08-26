package com.bigbike.bigbike_backend.api.chat.dto;

import java.time.Instant;
import java.util.UUID;

public record ChatSessionResponse(
        String visitorToken,
        Instant rememberedThrough,
        boolean memoryEnabled,
        UUID activeConversationId,
        String rememberedContextSummary
) {}
