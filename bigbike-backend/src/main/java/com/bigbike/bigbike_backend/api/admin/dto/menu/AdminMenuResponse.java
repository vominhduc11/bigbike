package com.bigbike.bigbike_backend.api.admin.dto.menu;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AdminMenuResponse(
        UUID id,
        String location,
        String name,
        String status,
        Instant createdAt,
        Instant updatedAt,
        List<AdminMenuItemResponse> items
) {}
