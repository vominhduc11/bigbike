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
        LocalDate dob,
        boolean emailVerified,
        String avatarUrl,
        /** True when this customer has ≥1 linked Google/Facebook identity — profile fields
         *  (name/avatar/email/phone/password) are then read-only, synced from the provider on
         *  each OAuth login instead of self-editable. See BUSINESS_RULES.md CUSTOMER_RULE_010. */
        boolean oauthManaged
) {}
