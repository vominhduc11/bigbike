package com.bigbike.bigbike_backend.api.admin.dto.redirect;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record UpdateRedirectRequest(
        @Size(max = 1024)
        String sourcePattern,
        @Size(max = 2048)
        String targetUrl,
        @Size(max = 32)
        String redirectType,
        // See CreateRedirectRequest.statusCode for why this bound is intentionally loose.
        @Min(100) @Max(599)
        Integer statusCode,
        @JsonAlias("isEnabled")
        Boolean enabled,
        @Size(max = 2000)
        String notes,
        Long legacyId
) {}
