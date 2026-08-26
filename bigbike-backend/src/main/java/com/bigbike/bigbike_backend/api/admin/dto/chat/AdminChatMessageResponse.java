package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.Instant;
import java.util.UUID;
import java.math.BigDecimal;
import java.util.List;
import com.bigbike.bigbike_backend.api.chat.dto.ChatImageResponse;

public record AdminChatMessageResponse(
        UUID id,
        long sequenceNo,
        String role,
        UUID staffUserId,
        String staffDisplayName,
        String content,
        String source,
        boolean aiCalled,
        String answerFormat,
        String resultKind,
        Integer inputTokens,
        Integer outputTokens,
        Integer thinkingTokens,
        Integer providerRequestCount,
        Integer latencyMs,
        BigDecimal estimatedCostUsd,
        String productsJson,
        Instant createdAt,
        List<ChatImageResponse> images
) {
    public AdminChatMessageResponse {
        images = images == null ? List.of() : List.copyOf(images);
    }

}
