package com.bigbike.bigbike_backend.service.inventory;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import java.util.List;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Availability-derivation policy (owner decision 2026-06-23): inventory is a boolean
 * "còn hàng / hết hàng" toggle, not a quantity. A variant's {@code stockState} mirrors its
 * {@code isAvailable} flag; a product-with-variants' {@code stockState} aggregates its variants.
 */
@Service
@RequiredArgsConstructor
public class InventoryPolicyService {

    /** A variant's stockState mirrors its availability boolean. */
    public void recomputeStockState(ProductVariantEntity variant) {
        boolean available = variant.isAvailable();
        variant.setStockState(available ? ProductStockState.IN_STOCK : ProductStockState.OUT_OF_STOCK);
        updateOutOfStockAge(variant, available);
    }

    /**
     * Product-with-variants aggregate: IN_STOCK if ANY variant is available, else OUT_OF_STOCK.
     * No-op for no-variant products (their state is set directly by the admin toggle).
     */
    public void recomputeProductStateFromVariants(ProductEntity product) {
        List<ProductVariantEntity> variants = product.getVariants();
        if (variants == null || variants.isEmpty()) return;
        boolean anyAvailable = variants.stream().anyMatch(ProductVariantEntity::isAvailable);
        product.setStockState(anyAvailable
                ? ProductStockState.IN_STOCK
                : ProductStockState.OUT_OF_STOCK);
        updateOutOfStockAge(product, anyAvailable);
    }

    /**
     * Recompute a product's {@code stockState} for BOTH shapes, so list/storefront read a value
     * that is always consistent with the admin's toggles:
     * <ul>
     *   <li>With variants: IN_STOCK if ANY variant is available, else OUT_OF_STOCK.</li>
     *   <li>No variants: mirror the product-level "còn/hết" switch, persisted as
     *       {@code available} (true → IN_STOCK, false → OUT_OF_STOCK).</li>
     * </ul>
     */
    public void recomputeProductState(ProductEntity product) {
        List<ProductVariantEntity> variants = product.getVariants();
        if (variants != null && !variants.isEmpty()) {
            boolean anyAvailable = variants.stream().anyMatch(ProductVariantEntity::isAvailable);
            product.setStockState(anyAvailable
                    ? ProductStockState.IN_STOCK
                    : ProductStockState.OUT_OF_STOCK);
            updateOutOfStockAge(product, anyAvailable);
            return;
        }
        boolean available = !Boolean.FALSE.equals(product.getAvailable());
        product.setStockState(available
                ? ProductStockState.IN_STOCK
                : ProductStockState.OUT_OF_STOCK);
        updateOutOfStockAge(product, available);
    }

    private static void updateOutOfStockAge(ProductVariantEntity variant, boolean available) {
        if (available) {
            variant.setOutOfStockSince(null);
            variant.setOutOfStockSinceEstimated(false);
        } else if (variant.getOutOfStockSince() == null) {
            variant.setOutOfStockSince(Instant.now());
            variant.setOutOfStockSinceEstimated(false);
        }
    }

    private static void updateOutOfStockAge(ProductEntity product, boolean available) {
        if (available) {
            product.setOutOfStockSince(null);
            product.setOutOfStockSinceEstimated(false);
        } else if (product.getOutOfStockSince() == null) {
            product.setOutOfStockSince(Instant.now());
            product.setOutOfStockSinceEstimated(false);
        }
    }
}
