package com.bigbike.bigbike_backend.api.admin.dto.inventory;

public record SerialImportRowRequest(
        String productId,
        String variantId,    // nullable for no-variant products
        String serialNumber, // required — product serial number (e.g. helmet/jacket serial)
        String note
) {}
