package com.bigbike.bigbike_backend.api.admin.dto.redirect;

import jakarta.validation.constraints.NotNull;

public record UpdateRedirectEnabledRequest(
        @NotNull Boolean enabled
) {}
