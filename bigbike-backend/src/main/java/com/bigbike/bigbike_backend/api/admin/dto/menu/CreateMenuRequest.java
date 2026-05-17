package com.bigbike.bigbike_backend.api.admin.dto.menu;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateMenuRequest(
        @NotBlank @Size(max = 64) String location,
        @NotBlank @Size(max = 255) String name,
        @Size(max = 32)
        String status
) {}
