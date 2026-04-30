package com.bigbike.bigbike_backend.api.order.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CustomerReturnResponse(
        UUID id,
        String returnNumber,
        UUID orderId,
        String orderNumber,
        String status,
        String reason,
        String customerNote,
        String adminNote,
        BigDecimal refundAmount,
        List<ReturnItemResponse> items,
        List<ReturnHistoryResponse> history,
        Instant createdAt,
        Instant updatedAt
) {
    public record ReturnItemResponse(
            UUID id,
            String productName,
            String variantName,
            String sku,
            int quantity,
            BigDecimal unitPrice,
            String reason
    ) {}

    public record ReturnHistoryResponse(
            String fromStatus,
            String toStatus,
            String note,
            Instant createdAt
    ) {}
}
