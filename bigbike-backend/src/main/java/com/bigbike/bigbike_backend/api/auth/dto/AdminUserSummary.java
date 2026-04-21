package com.bigbike.bigbike_backend.api.auth.dto;

import java.util.List;

public record AdminUserSummary(
        String id,
        String email,
        String displayName,
        String role,
        List<String> permissions
) {
}
