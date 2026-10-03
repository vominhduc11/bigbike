package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Rename an existing attribute value. The slug is intentionally immutable because
 * variant options reference it as a stable key (changing it would break
 * colour-scoped galleries and web filters). A used value normally cannot change;
 * only the Bo and bolt-size dictionaries may submit an unchanged Vietnamese label
 * with a replacement English label.
 */
public record UpdateAttributeValueRequest(
        @NotBlank @Size(max = 255) String label,
        @Size(max = 255) String labelEn
) {}
