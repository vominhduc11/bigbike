package com.bigbike.bigbike_backend.api.admin.dto.contact;

import java.time.Instant;
import java.util.UUID;

public record AdminContactMessageDetail(
        UUID id,
        String fullName,
        String phone,
        String email,
        String content,
        String status,
        String adminNote,
        UUID assignedAdminId,
        String assignedAdminName,
        String ipAddress,
        String userAgent,
        Instant createdAt,
        Instant updatedAt,
        Instant resolvedAt
) {}
