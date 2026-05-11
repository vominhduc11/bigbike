package com.bigbike.bigbike_backend.api.admin.dto.returns;

import jakarta.validation.constraints.NotBlank;

public record InspectReturnItemRequest(
        @NotBlank String result,
        String note
) {}
