package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Create a brand-new attribute type (e.g. "Chất liệu"). {@code code} (the
 * immutable machine key) is derived from {@code name} using the same
 * diacritic-insensitive kebab-case rule as attribute values / product slugs.
 */
public record CreateAttributeRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 255) String nameEn
) {}
