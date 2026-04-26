package com.bigbike.bigbike_backend.service.ws;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record OrderWsEvent(
        String type,          // "NEW_ORDER" | "ORDER_STATUS_CHANGED"
        UUID orderId,
        String orderNumber,
        String customerName,
        BigDecimal total,
        String status,
        String paymentMethod,
        Instant timestamp
) {}
