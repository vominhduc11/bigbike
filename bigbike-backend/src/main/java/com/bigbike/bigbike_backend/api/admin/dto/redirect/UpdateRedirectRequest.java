package com.bigbike.bigbike_backend.api.admin.dto.redirect;

public record UpdateRedirectRequest(
        String sourcePattern,
        String targetUrl,
        String redirectType,
        Integer statusCode,
        Boolean enabled,
        String notes
) {}
