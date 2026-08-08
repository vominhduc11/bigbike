package com.bigbike.bigbike_backend.api.admin.dto.redirect;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Size;

public record UpdateRedirectRequest(
        @Size(max = 1024)
        String sourcePattern,
        @Size(max = 2048)
        String targetUrl,
        @JsonAlias("isEnabled")
        Boolean enabled,
        Integer statusCode,
        String redirectType
) {}
