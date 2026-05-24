package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Pattern;

public record AttributeValueSwatchRequest(
        @Pattern(
                regexp = "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$",
                message = "colorHex phải là #RRGGBB hoặc #RGB"
        )
        String colorHex,
        /** Direct public URL of the swatch image (as returned by the media upload API). */
        String swatchImageUrl
) {}
