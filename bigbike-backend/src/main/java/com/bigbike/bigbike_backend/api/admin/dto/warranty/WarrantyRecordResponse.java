package com.bigbike.bigbike_backend.api.admin.dto.warranty;

import java.time.LocalDate;
import java.time.Instant;
import java.util.UUID;

public record WarrantyRecordResponse(
        UUID id,
        UUID serialId,
        UUID orderLineItemId,
        UUID customerId,
        String customerEmail,
        String customerPhone,
        LocalDate startDate,
        LocalDate endDate,
        String status,
        Instant createdAt
) {}
