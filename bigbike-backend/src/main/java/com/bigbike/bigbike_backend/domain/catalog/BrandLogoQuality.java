package com.bigbike.bigbike_backend.domain.catalog;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/** Admin-only, non-blocking diagnostics for the brand logo currently stored on a Brand. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record BrandLogoQuality(
        String status,
        List<String> issues,
        Integer width,
        Integer height,
        Long fileSize,
        String mimeType,
        Boolean transparent,
        Double ratio
) {
}
