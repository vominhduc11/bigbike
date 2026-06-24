package com.bigbike.bigbike_backend.api.catalog.dto;

import com.bigbike.bigbike_backend.domain.catalog.ProductVariant;
import java.math.BigDecimal;
import java.util.List;

/**
 * Lightweight pricing/stock snapshot used by the storefront and mobile app to refresh the
 * "buy box" without re-fetching the full product payload.
 */
public record ProductSnapshotResponse(
        Pricing pricing,
        Stock stock,
        List<ProductVariant> variants
) {
    public record Pricing(
            BigDecimal retailPrice,
            BigDecimal compareAtPrice,
            BigDecimal salePrice,
            int discountPercent,
            String currency
    ) {}

    public record Stock(
            String stockState,
            String label,
            boolean forceOutOfStock,
            /**
             * Dormant: on-hand quantity is no longer tracked for availability
             * (boolean "còn/hết" model since 2026-06-23). The storefront ignores it.
             */
            Integer quantity
    ) {}
}
