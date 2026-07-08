package com.bigbike.bigbike_backend.service.pricing;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/**
 * PRODUCT_RULE_013 (2026-07-06; extended 2026-07-07) — a variant without its own retailPrice falls
 * back to the product's shared retailPrice/salePrice; a variant with its own retailPrice never falls
 * back, even for salePrice alone. This is the same logic reused by cart/checkout pricing and by the
 * catalog read/display path ({@code JpaCatalogReadRepository.toVariant}/{@code toVariantForListing}).
 */
class VariantPricingTest {

    @Test
    void variantWithoutOwnRetailPrice_fallsBackToProductRetailAndSale() {
        ProductEntity product = productWithPrice(BigDecimal.valueOf(100), BigDecimal.valueOf(80));
        ProductVariantEntity variant = variantWithPrice(null, null);

        assertThat(VariantPricing.regularPrice(product, variant)).isEqualByComparingTo("100");
        assertThat(VariantPricing.salePrice(product, variant)).isEqualByComparingTo("80");
        assertThat(VariantPricing.resolveUnitPrice(product, variant)).isEqualByComparingTo("80.00");
    }

    @Test
    void variantWithOwnRetailPrice_usesOwnPriceAndOwnSale() {
        ProductEntity product = productWithPrice(BigDecimal.valueOf(100), BigDecimal.valueOf(80));
        ProductVariantEntity variant = variantWithPrice(BigDecimal.valueOf(120), BigDecimal.valueOf(110));

        assertThat(VariantPricing.regularPrice(product, variant)).isEqualByComparingTo("120");
        assertThat(VariantPricing.salePrice(product, variant)).isEqualByComparingTo("110");
        assertThat(VariantPricing.resolveUnitPrice(product, variant)).isEqualByComparingTo("110.00");
    }

    @Test
    void variantWithOwnRetailPriceButNoOwnSale_neverFallsBackToProductSale() {
        // Confirmed owner decision (2026-07-07): a self-priced variant with no sale of its own has
        // no sale at all — it must NOT pick up the product's salePrice.
        ProductEntity product = productWithPrice(BigDecimal.valueOf(100), BigDecimal.valueOf(80));
        ProductVariantEntity variant = variantWithPrice(BigDecimal.valueOf(120), null);

        assertThat(VariantPricing.regularPrice(product, variant)).isEqualByComparingTo("120");
        assertThat(VariantPricing.salePrice(product, variant)).isNull();
        assertThat(VariantPricing.resolveUnitPrice(product, variant)).isEqualByComparingTo("120.00");
    }

    @Test
    void variantWithoutOwnRetailPrice_andProductWithNoSale_hasNoSale() {
        ProductEntity product = productWithPrice(BigDecimal.valueOf(100), null);
        ProductVariantEntity variant = variantWithPrice(null, null);

        assertThat(VariantPricing.regularPrice(product, variant)).isEqualByComparingTo("100");
        assertThat(VariantPricing.salePrice(product, variant)).isNull();
        assertThat(VariantPricing.resolveUnitPrice(product, variant)).isEqualByComparingTo("100.00");
    }

    private static ProductEntity productWithPrice(BigDecimal retailPrice, BigDecimal salePrice) {
        ProductEntity product = new ProductEntity();
        product.setRetailPrice(retailPrice);
        product.setSalePrice(salePrice);
        return product;
    }

    private static ProductVariantEntity variantWithPrice(BigDecimal retailPrice, BigDecimal salePrice) {
        ProductVariantEntity variant = new ProductVariantEntity();
        variant.setRetailPrice(retailPrice);
        variant.setSalePrice(salePrice);
        return variant;
    }
}
