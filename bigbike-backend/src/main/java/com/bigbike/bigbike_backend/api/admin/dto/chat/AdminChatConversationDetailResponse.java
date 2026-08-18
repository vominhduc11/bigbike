package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.math.BigDecimal;

public record AdminChatConversationDetailResponse(
        UUID id,
        UUID customerId,
        String locale,
        int turnCount,
        int aiCallCount,
        String leadOfferStatus,
        String endedReason,
        Instant startedAt,
        Instant lastMessageAt,
        long inputTokens,
        long outputTokens,
        long thinkingTokens,
        long providerRequests,
        Long averageLatencyMs,
        BigDecimal estimatedCostUsd,
        long contentRefusals,
        long assistedOrders,
        BigDecimal assistedRevenue,
        List<AdminChatMessageResponse> messages,
        List<AdminChatOrderAttributionResponse> orderAttributions,
        AdminChatLeadResponse lead
) {}
