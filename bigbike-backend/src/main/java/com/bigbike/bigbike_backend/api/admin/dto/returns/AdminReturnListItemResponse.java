package com.bigbike.bigbike_backend.api.admin.dto.returns;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record AdminReturnListItemResponse(
        UUID id,
        String returnNumber,
        UUID orderId,
        String orderNumber,
        String customerEmail,
        String status,
        String reason,
        BigDecimal refundAmount,
        Instant createdAt
) {}
