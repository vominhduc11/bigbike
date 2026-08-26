package com.bigbike.bigbike_backend.api.chat.dto;

import java.util.UUID;

public record ChatContinuationResponse(
        boolean available,
        UUID threadId,
        UUID successorConversationId,
        String message
) {}
