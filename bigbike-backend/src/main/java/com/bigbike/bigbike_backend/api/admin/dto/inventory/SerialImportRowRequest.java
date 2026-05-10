package com.bigbike.bigbike_backend.api.admin.dto.inventory;

public record SerialImportRowRequest(
        String productId,
        String variantId,         // nullable for no-variant products
        String chassisNumber,     // at least one of chassis/engine required
        String engineNumber,
        String note,
        boolean enableTracking    // if true, sets track_serials=true on the variant/product
) {}
