package com.bigbike.bigbike_backend.api.admin.dto.order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record AdminOrderListItemResponse(
        UUID id,
        String orderNumber,
        String status,
        String paymentStatus,
        // Delivery lifecycle for the list's "Giao hàng" column — without these every
        // order rendered as unfulfilled because the UI had no data (AUD-016).
        String fulfillmentStatus,
        String fulfillmentType,
        String customerEmail,
        String customerPhone,
        String customerName,
        BigDecimal totalAmount,
        String currency,
        Instant placedAt,
        int itemCount,
        String source
) {}
