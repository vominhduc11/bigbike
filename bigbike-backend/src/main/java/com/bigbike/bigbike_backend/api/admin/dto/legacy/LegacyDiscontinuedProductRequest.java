package com.bigbike.bigbike_backend.api.admin.dto.legacy;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record LegacyDiscontinuedProductRequest(
        @NotBlank @Size(max = 255) @Pattern(regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$", message = "Invalid legacy slug.") String slug,
        @NotBlank @Size(max = 255) String name,
        @Size(max = 255) String nameEn,
        @Size(max = 255) String brandName,
        @NotBlank @Size(max = 255) @Pattern(regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$", message = "Invalid category slug.") String categorySlug,
        @Size(max = 2048) String imageUrl,
        Boolean enabled
) {}
