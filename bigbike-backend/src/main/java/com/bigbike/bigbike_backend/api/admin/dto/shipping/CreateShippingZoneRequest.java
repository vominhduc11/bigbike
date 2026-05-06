package com.bigbike.bigbike_backend.api.admin.dto.shipping;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateShippingZoneRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 50) String regionCode,
        Integer sortOrder,
        Boolean enabled
) {}
