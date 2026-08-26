package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.math.BigDecimal;

public record AdminChatFallbackStatsResponse(
        long today,
        long month,
        BigDecimal rate,
        String lastReason,
        long giveUpCount14Days,
        long replyCount14Days,
        BigDecimal giveUpRate14Days,
        BigDecimal baselineGiveUpRate,
        Integer p50LatencyMs14Days,
        Integer p95LatencyMs14Days
) {}
