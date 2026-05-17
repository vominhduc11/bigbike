package com.bigbike.bigbike_backend.api.admin.dto.inventory;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SerialImportRowRequest(
        @Size(max = 64)
        String productId,
        @Size(max = 64)
        String variantId,    // nullable for no-variant products
        @NotBlank
        @Size(max = 100)
        String serialNumber, // product serial number (for example helmet/jacket serial)
        @Size(max = 1000)
        String note
) {}
