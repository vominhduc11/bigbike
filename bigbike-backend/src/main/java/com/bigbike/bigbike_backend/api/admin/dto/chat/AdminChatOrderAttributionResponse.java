package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record AdminChatOrderAttributionResponse(
        UUID orderId,
        UUID orderLineItemId,
        UUID interactionId,
        String actionType,
        BigDecimal attributedAmount,
        String currency,
        Instant createdAt
) {
    public AdminChatOrderAttributionResponse(
            UUID orderId,
            UUID orderLineItemId,
            BigDecimal attributedAmount,
            String currency,
            Instant createdAt
    ) {
        this(orderId, orderLineItemId, null, null, attributedAmount, currency, createdAt);
    }
}
