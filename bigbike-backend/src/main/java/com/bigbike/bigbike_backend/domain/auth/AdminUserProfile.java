package com.bigbike.bigbike_backend.domain.auth;

import java.time.Instant;
import java.util.List;

public record AdminUserProfile(
        String id,
        String fullName,
        String email,
        List<String> roles,
        List<String> permissions,
        String status,
        Instant createdAt,
        Instant updatedAt
) {
}
