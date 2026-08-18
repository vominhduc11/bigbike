package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.Instant;
import java.util.UUID;
import java.math.BigDecimal;

public record AdminChatConversationResponse(
        UUID id,
        String locale,
        String customerDisplayName,
        int turnCount,
        int aiCallCount,
        boolean hasLead,
        long inputTokens,
        long outputTokens,
        long thinkingTokens,
        long providerRequests,
        Long averageLatencyMs,
        BigDecimal estimatedCostUsd,
        long contentRefusals,
        long assistedOrders,
        BigDecimal assistedRevenue,
        Instant startedAt,
        Instant lastMessageAt,
        String endedReason
) {}
