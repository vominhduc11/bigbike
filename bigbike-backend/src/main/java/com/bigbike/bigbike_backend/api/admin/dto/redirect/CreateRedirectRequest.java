package com.bigbike.bigbike_backend.api.admin.dto.redirect;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateRedirectRequest(
        @NotBlank @Size(max = 1024) String sourcePattern,
        @NotBlank @Size(max = 2048) String targetUrl,
        @JsonAlias("isEnabled")
        Boolean enabled,
        @Size(max = 2000) String notes,
        Long legacyId,
        Integer statusCode,
        String redirectType
) {}
