package com.bigbike.bigbike_backend.api.admin.dto.customer;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AdminCustomerDetailResponse(
        UUID id,
        Long legacyId,
        String email,
        String phone,
        String displayName,
        String firstName,
        String lastName,
        String status,
        boolean isSynthetic,
        Instant emailVerifiedAt,
        Instant phoneVerifiedAt,
        Instant lastLoginAt,
        Instant createdAt,
        Instant updatedAt,
        List<AdminCustomerAddressResponse> addresses,
        AdminCustomerOrderSummaryResponse orderSummary
) {}
