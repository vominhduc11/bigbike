package com.bigbike.bigbike_backend.api.admin.dto.returns;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AdminReturnDetailResponse(
        UUID id,
        String returnNumber,
        UUID orderId,
        UUID customerId,
        String orderNumber,
        String customerEmail,
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
            String reason,
            String inspectionResult,
            String inspectionNote,
            Instant inspectedAt
    ) {}

    public record ReturnHistoryResponse(
            String fromStatus,
            String toStatus,
            String note,
            Instant createdAt
    ) {}
}
