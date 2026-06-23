package com.bigbike.bigbike_backend.service.inventory;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Availability-derivation policy (owner decision 2026-06-23): inventory is a boolean
 * "còn hàng / hết hàng" toggle, not a quantity. A variant's {@code stockState} mirrors its
 * {@code isAvailable} flag; a product-with-variants' {@code stockState} aggregates its variants.
 * The {@code LOW_STOCK} enum value is kept for backward compatibility but is never produced.
 */
@Service
@RequiredArgsConstructor
public class InventoryPolicyService {

    /** A variant's stockState mirrors its availability boolean. */
    public void recomputeStockState(ProductVariantEntity variant) {
        variant.setStockState(variant.isAvailable()
                ? ProductStockState.IN_STOCK
                : ProductStockState.OUT_OF_STOCK);
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
    }
}
