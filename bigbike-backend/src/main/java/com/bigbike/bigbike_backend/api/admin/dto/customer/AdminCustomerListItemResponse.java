package com.bigbike.bigbike_backend.api.admin.dto.customer;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record AdminCustomerListItemResponse(
        UUID id,
        Long legacyId,
        String email,
        String phone,
        String displayName,
        String status,
        boolean isSynthetic,
        Instant lastLoginAt,
        Instant createdAt,
        int orderCount,
        BigDecimal totalSpent
) {}
