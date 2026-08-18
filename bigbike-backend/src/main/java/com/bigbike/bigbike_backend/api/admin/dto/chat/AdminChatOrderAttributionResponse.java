package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record AdminChatOrderAttributionResponse(
        UUID orderId,
        UUID orderLineItemId,
        BigDecimal attributedAmount,
        String currency,
        Instant createdAt
) {}
