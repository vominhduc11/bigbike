package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.math.BigDecimal;

public record AdminChatCostStatsResponse(
        BigDecimal todayUsd,
        BigDecimal monthUsd,
        BigDecimal averagePerConversationUsd,
        BigDecimal textTodayUsd,
        BigDecimal textMonthUsd,
        BigDecimal imageTodayUsd,
        BigDecimal imageMonthUsd,
        BigDecimal indexTodayUsd,
        BigDecimal indexMonthUsd,
        BigDecimal evaluationTodayUsd,
        BigDecimal evaluationMonthUsd
) {}
