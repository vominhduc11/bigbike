package com.bigbike.bigbike_backend.service.ws;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record OrderWsEvent(
        // type values:
        //   "NEW_ORDER"                  — new order placed (paymentMethod = payment method string, e.g. "COD")
        //   "ORDER_STATUS_CHANGED"       — order status updated (paymentMethod = current paymentStatus)
        //   "ORDER_PAYMENT_STATUS_CHANGED" — payment status updated (paymentMethod = new paymentStatus)
        //   "ORDER_REFUND_CREATED"       — refund applied (paymentMethod = new paymentStatus after refund)
        //   "ORDER_NOTE_ADDED"           — note added to order (paymentMethod = current paymentStatus)
        String type,
        UUID orderId,
        String orderNumber,
        String customerName,
        BigDecimal total,
        String status,
        String paymentMethod,   // semantics vary by event type — see type comments above
        Instant timestamp
) {}
