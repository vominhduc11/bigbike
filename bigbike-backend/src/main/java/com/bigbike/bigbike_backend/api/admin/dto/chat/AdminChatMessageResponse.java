package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.Instant;
import java.util.UUID;
import java.math.BigDecimal;

public record AdminChatMessageResponse(
        UUID id,
        String role,
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
        Instant createdAt
) {}
