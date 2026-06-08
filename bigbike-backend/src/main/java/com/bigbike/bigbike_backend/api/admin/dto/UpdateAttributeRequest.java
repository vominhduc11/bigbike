package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Rename an attribute's display name. Only {@code name} changes; the {@code code}
 * (machine key) is intentionally immutable because variant options resolve to
 * their attribute via the code, so changing it would break those links.
 */
public record UpdateAttributeRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 255) String nameEn
) {}
