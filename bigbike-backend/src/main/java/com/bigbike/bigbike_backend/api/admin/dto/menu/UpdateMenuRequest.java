package com.bigbike.bigbike_backend.api.admin.dto.menu;

import jakarta.validation.constraints.Size;

public record UpdateMenuRequest(
        @Size(max = 255)
        String name,
        @Size(max = 32)
        String status
) {}
