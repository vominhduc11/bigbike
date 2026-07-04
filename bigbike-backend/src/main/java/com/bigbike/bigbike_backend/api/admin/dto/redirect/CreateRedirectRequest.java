package com.bigbike.bigbike_backend.api.admin.dto.redirect;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateRedirectRequest(
        @NotBlank @Size(max = 1024) String sourcePattern,
        @NotBlank @Size(max = 2048) String targetUrl,
        @Size(max = 32) String redirectType,
        // Loose bound only (100-599 = valid HTTP status range) — the real business allow-list
        // {301,302,307,308} is enforced in AdminRedirectService.normalizeStatusCode (business
        // rule, not a structural constraint — see BUSINESS_RULES.md REDIRECT_RULE_005).
        @Min(100) @Max(599) Integer statusCode,
        @JsonAlias("isEnabled")
        Boolean enabled,
        @Size(max = 2000) String notes,
        Long legacyId
) {}
