package com.bigbike.bigbike_backend.api.order.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderListItemResponse(
        UUID id,
        String orderNumber,
        String status,
        String paymentStatus,
        BigDecimal totalAmount,
        String currency,
        Instant placedAt,
        int itemCount,
        List<String> productNames,
        String channel
) {}
