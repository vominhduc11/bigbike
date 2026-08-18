package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.LocalDate;
import java.math.BigDecimal;

public record AdminChatStatsResponse(
        LocalDate date,
        long aiCalls,
        long conversations,
        long leads,
        long unanswered,
        long contentRefusals,
        int dailyLimit,
        long remainingAiCalls,
        long inputTokens,
        long outputTokens,
        long thinkingTokens,
        long providerRequests,
        Long averageLatencyMs,
        BigDecimal estimatedCostUsd,
        long assistedOrders,
        BigDecimal assistedRevenue
) {}
