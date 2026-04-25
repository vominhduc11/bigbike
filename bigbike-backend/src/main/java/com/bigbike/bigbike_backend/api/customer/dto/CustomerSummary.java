package com.bigbike.bigbike_backend.api.customer.dto;

import java.time.LocalDate;
import java.util.UUID;

public record CustomerSummary(
        UUID id,
        String email,
        String phone,
        String displayName,
        String status,
        String gender,
        LocalDate dob
) {}
