package com.bigbike.bigbike_backend.service.inventory;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class InventoryPolicyServiceOutOfStockAgeTest {

    private final InventoryPolicyService service = new InventoryPolicyService();

    @Test
    void variantTransitionTracksOneExactStartAndRestockClearsIt() {
        ProductVariantEntity variant = new ProductVariantEntity();
        variant.setAvailable(false);

        service.recomputeStockState(variant);
        Instant firstStart = variant.getOutOfStockSince();
        service.recomputeStockState(variant);

        assertThat(variant.getStockState()).isEqualTo(ProductStockState.OUT_OF_STOCK);
        assertThat(variant.getOutOfStockSince()).isEqualTo(firstStart);
        assertThat(variant.isOutOfStockSinceEstimated()).isFalse();

        variant.setAvailable(true);
        service.recomputeStockState(variant);

        assertThat(variant.getStockState()).isEqualTo(ProductStockState.IN_STOCK);
        assertThat(variant.getOutOfStockSince()).isNull();
        assertThat(variant.isOutOfStockSinceEstimated()).isFalse();
    }

    @Test
    void productKeepsExistingAnyVariantAvailabilityRuleWhileTrackingAge() {
        ProductVariantEntity unavailable = variant(false);
        ProductVariantEntity available = variant(true);
        ProductEntity product = new ProductEntity();
        product.setVariants(new ArrayList<>(List.of(unavailable, available)));

        service.recomputeProductState(product);

        assertThat(product.getStockState()).isEqualTo(ProductStockState.IN_STOCK);
        assertThat(product.getOutOfStockSince()).isNull();

        available.setAvailable(false);
        service.recomputeProductState(product);

        assertThat(product.getStockState()).isEqualTo(ProductStockState.OUT_OF_STOCK);
        assertThat(product.getOutOfStockSince()).isNotNull();
        assertThat(product.isOutOfStockSinceEstimated()).isFalse();
    }

    private static ProductVariantEntity variant(boolean available) {
        ProductVariantEntity variant = new ProductVariantEntity();
        variant.setAvailable(available);
        return variant;
    }
}
