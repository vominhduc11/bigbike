package com.bigbike.bigbike_backend.api.admin.dto.receivable;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ReceivableListItemResponse(
        UUID id,
        UUID orderId,
        String orderNumber,
        UUID customerId,
        String customerName,
        String customerPhone,
        BigDecimal originalAmount,
        BigDecimal paidAmount,
        BigDecimal outstandingAmount,
        String status,
        LocalDate dueDate,
        Integer overdueDays,
        String createdFrom,
        Instant createdAt
) {}
