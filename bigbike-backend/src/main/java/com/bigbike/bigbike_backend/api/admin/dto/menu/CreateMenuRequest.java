package com.bigbike.bigbike_backend.api.admin.dto.menu;

import jakarta.validation.constraints.NotBlank;

public record CreateMenuRequest(
        @NotBlank String location,
        @NotBlank String name,
        String status
) {}
