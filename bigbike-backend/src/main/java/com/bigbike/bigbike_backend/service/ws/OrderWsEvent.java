package com.bigbike.bigbike_backend.service.ws;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record OrderWsEvent(
        // type values:
        //   "NEW_ORDER"                  — new order placed (paymentMethod = payment method string, e.g. "COD")
        //   "ORDER_STATUS_CHANGED"       — order status updated (paymentMethod = current method)
        String type,
        UUID orderId,
        String orderNumber,
        String customerName,
        BigDecimal total,
        String status,
        String paymentMethod,
        Instant timestamp
) {}
