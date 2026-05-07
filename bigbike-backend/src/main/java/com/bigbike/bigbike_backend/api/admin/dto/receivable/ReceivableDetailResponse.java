package com.bigbike.bigbike_backend.api.admin.dto.receivable;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ReceivableDetailResponse(
        UUID id,
        UUID orderId,
        String orderNumber,
        UUID customerId,
        String customerName,
        String customerPhone,
        BigDecimal originalAmount,
        BigDecimal paidAmount,
        BigDecimal outstandingAmount,
        BigDecimal writtenOffAmount,
        String status,
        LocalDate dueDate,
        Integer paymentTermsDays,
        Integer overdueDays,
        BigDecimal creditLimitSnapshot,
        String createdFrom,
        String note,
        String writeOffReason,
        Instant writtenOffAt,
        UUID createdByAdminId,
        Instant createdAt,
        Instant updatedAt
) {}
