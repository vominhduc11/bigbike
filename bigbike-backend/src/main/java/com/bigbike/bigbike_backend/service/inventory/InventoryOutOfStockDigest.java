package com.bigbike.bigbike_backend.service.inventory;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Immutable snapshot shared by the admin bell and the one internal email. */
public record InventoryOutOfStockDigest(
        int schemaVersion,
        LocalDate digestDate,
        Instant generatedAt,
        Counts counts,
        List<ProductItem> fullyOutOfStock,
        List<PartialProductItem> partiallyOutOfStock
) {
    public static final int SCHEMA_VERSION = 1;

    public boolean isEmpty() {
        return fullyOutOfStock.isEmpty() && partiallyOutOfStock.isEmpty();
    }

    public record Counts(
            int fullyOutOfStockProducts,
            int partiallyOutOfStockProducts,
            int unavailableVariants
    ) {}

    public record ProductItem(
            String productId,
            String nameVi,
            String nameEn,
            String sku,
            String editPath,
            Instant outOfStockSince,
            long outOfStockDays,
            boolean outOfStockSinceEstimated
    ) {}

    public record PartialProductItem(
            String productId,
            String nameVi,
            String nameEn,
            String sku,
            String editPath,
            Instant outOfStockSince,
            long outOfStockDays,
            boolean outOfStockSinceEstimated,
            List<VariantItem> unavailableVariants
    ) {}

    public record VariantItem(
            String variantId,
            String nameVi,
            String nameEn,
            String sku,
            Instant outOfStockSince,
            long outOfStockDays,
            boolean outOfStockSinceEstimated
    ) {}
}
