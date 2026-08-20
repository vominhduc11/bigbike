package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.math.BigDecimal;

public record AdminChatActionStatsResponse(
        String actionType,
        long clicks,
        long cartLines,
        long orders,
        BigDecimal revenue,
        BigDecimal conversionRate
) {}
