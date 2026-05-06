package com.bigbike.bigbike_backend.api.admin.dto.shipping;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record CreateShippingMethodRequest(
        @NotBlank @Pattern(regexp = "[a-z0-9_-]+", message = "methodCode must contain only lowercase letters, digits, underscores, or hyphens")
        @Size(max = 100) String methodCode,
        @NotBlank @Size(max = 255) String title,
        String description,
        @DecimalMin(value = "0", message = "cost must be >= 0") BigDecimal cost,
        @DecimalMin(value = "0", message = "minOrderAmount must be >= 0") BigDecimal minOrderAmount,
        @DecimalMin(value = "0", message = "freeShippingThreshold must be >= 0") BigDecimal freeShippingThreshold,
        Integer sortOrder,
        Boolean enabled
) {}
