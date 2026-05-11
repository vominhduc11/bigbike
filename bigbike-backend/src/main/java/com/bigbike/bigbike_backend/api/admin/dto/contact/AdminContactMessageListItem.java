package com.bigbike.bigbike_backend.api.admin.dto.contact;

import java.time.Instant;
import java.util.UUID;

public record AdminContactMessageListItem(
        UUID id,
        String fullName,
        String phone,
        String email,
        String contentPreview,
        String status,
        UUID assignedAdminId,
        Instant createdAt,
        Instant resolvedAt
) {}
