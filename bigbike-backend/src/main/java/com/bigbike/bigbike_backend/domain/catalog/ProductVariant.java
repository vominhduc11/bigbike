package com.bigbike.bigbike_backend.domain.catalog;

import java.util.List;

public record ProductVariant(
        String id,
        String sku,
        String name,
        List<ProductVariantOption> options,
        ProductPrice price,
        ProductStockState stockState,
        /** On-hand count for this specific variant. Null if not tracked. */
        Integer stockQuantity,
        ImageAsset image,
        List<ImageAsset> gallery,
        boolean isAvailable,
        boolean trackSerials
) {
}

