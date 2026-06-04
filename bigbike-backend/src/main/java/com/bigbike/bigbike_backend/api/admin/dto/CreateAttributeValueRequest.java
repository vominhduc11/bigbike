package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Create a new value (e.g. a colour) under an attribute. {@code label} is the
 * human-readable display text; {@code slug} is optional and, when blank, is
 * derived from the label (diacritic-insensitive kebab-case) so it stays in sync
 * with the storefront colour filter keys.
 */
public record CreateAttributeValueRequest(
        @NotBlank @Size(max = 255) String label,
        @Size(max = 255) String slug
) {}
