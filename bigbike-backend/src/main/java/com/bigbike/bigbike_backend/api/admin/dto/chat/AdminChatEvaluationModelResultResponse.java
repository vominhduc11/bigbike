package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.math.BigDecimal;

public record AdminChatEvaluationModelResultResponse(
        String modelId,
        int totalCases,
        int passedCases,
        int numericCaseCount,
        BigDecimal numericAccuracy,
        BigDecimal intentAccuracy,
        int nonFabricationCaseCount,
        BigDecimal nonFabricationRate,
        BigDecimal giveUpRate,
        Integer p50LatencyMs,
        Integer p95LatencyMs,
        long inputTokens,
        long outputTokens,
        long thinkingTokens,
        int fallbackCount,
        BigDecimal estimatedCostUsd,
        BigDecimal averageCostUsd
) {}
