package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;

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
        BigDecimal assistedRevenue,
        AdminChatQualityStatsResponse quality,
        AdminChatLeadFunnelResponse leadFunnel,
        List<AdminChatActionStatsResponse> actionStats,
        BigDecimal monthlyCostUsd,
        BigDecimal monthlyCostWarningUsd,
        boolean monthlyCostWarningExceeded,
        AdminChatCostStatsResponse costs,
        AdminChatFallbackStatsResponse fallbacks,
        List<AdminChatModelUsageResponse> modelUsage
) {}
