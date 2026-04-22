package com.bigbike.bigbike_backend.api.admin.dto.redirect;

import jakarta.validation.constraints.NotBlank;

public record CreateRedirectRequest(
        @NotBlank String sourcePattern,
        @NotBlank String targetUrl,
        String redirectType,
        Integer statusCode,
        Boolean enabled,
        String notes
) {}
