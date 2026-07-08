package com.bigbike.bigbike_backend.service.pricing;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Shared/default variant pricing rule (owner decision 2026-07-06, extended 2026-07-07): a product
 * with zero variants is priced at the product level. A product with one or more variants may still
 * carry a product-level retailPrice/salePrice ("giá chung") that acts as the default for any variant
 * that has no retailPrice of its own. A variant with its own retailPrice is "self-priced" — it uses
 * its own retailPrice and (if set) its own salePrice, and never falls back to the product's salePrice
 * even when it has no sale price of its own (see {@code CatalogRequestValidator}/{@code
 * AdminMutationValidators}, which reject a variant salePrice submitted without a variant retailPrice,
 * precisely to avoid a silently-ignored sale price under this rule).
 *
 * <p>This is a deliberate, permanent rule — not a legacy-data patch. It is used both for cart/checkout
 * pricing ({@code CartService}, {@code CheckoutSupport}) and for the catalog read/display path
 * ({@code JpaCatalogReadRepository}), so the storefront and admin show the same effective price that
 * checkout charges.
 */
public final class VariantPricing {

    private VariantPricing() {}

    public static BigDecimal resolveUnitPrice(ProductEntity product, ProductVariantEntity variant) {
        BigDecimal retail = regularPrice(product, variant);
        BigDecimal sale = salePrice(product, variant);
        BigDecimal price = sale != null ? sale : retail;
        return price.setScale(2, RoundingMode.HALF_UP);
    }

    public static BigDecimal regularPrice(ProductEntity product, ProductVariantEntity variant) {
        return hasOwnPrice(variant) ? variant.getRetailPrice() : product.getRetailPrice();
    }

    public static BigDecimal salePrice(ProductEntity product, ProductVariantEntity variant) {
        return hasOwnPrice(variant) ? variant.getSalePrice() : product.getSalePrice();
    }

    private static boolean hasOwnPrice(ProductVariantEntity variant) {
        return variant != null && variant.getRetailPrice() != null;
    }
}
