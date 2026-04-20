package com.bigbike.bigbike_backend.domain.catalog;

import java.util.List;

public record ProductVariant(
        String id,
        String sku,
        String name,
        List<ProductVariantOption> options,
        ProductPrice price,
        ProductStockState stockState,
        ImageAsset image,
        boolean isAvailable
) {
}

