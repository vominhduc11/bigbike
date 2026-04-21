package com.bigbike.bigbike_backend.api.customer.dto;

import java.util.UUID;

public record CustomerSummary(
        UUID id,
        String email,
        String phone,
        String displayName,
        String status
) {}
