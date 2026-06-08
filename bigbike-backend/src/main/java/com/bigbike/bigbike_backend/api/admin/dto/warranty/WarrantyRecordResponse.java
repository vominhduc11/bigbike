package com.bigbike.bigbike_backend.api.admin.dto.warranty;

import java.time.LocalDate;
import java.time.Instant;
import java.util.UUID;

public record WarrantyRecordResponse(
        UUID id,
        UUID serialId,
        String serialNumber,
        UUID orderLineItemId,
        String orderNumber,
        String productName,
        String variantName,
        UUID customerId,
        String customerEmail,
        String customerPhone,
        LocalDate startDate,
        LocalDate endDate,
        String status,
        Instant createdAt
) {}
