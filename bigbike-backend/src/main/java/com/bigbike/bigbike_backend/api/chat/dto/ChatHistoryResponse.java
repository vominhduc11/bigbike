package com.bigbike.bigbike_backend.api.chat.dto;

import java.util.List;
import java.util.UUID;

public record ChatHistoryResponse(
        UUID conversationId,
        UUID threadId,
        long latestSequence,
        List<ChatHistoryMessageResponse> messages
) {}
