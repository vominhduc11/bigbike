package com.bigbike.bigbike_backend.api.admin.dto.order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record AdminOrderListItemResponse(
        UUID id,
        String orderNumber,
        String status,
        String paymentStatus,
        String customerEmail,
        String customerPhone,
        BigDecimal totalAmount,
        String currency,
        Instant placedAt,
        int itemCount
) {}
