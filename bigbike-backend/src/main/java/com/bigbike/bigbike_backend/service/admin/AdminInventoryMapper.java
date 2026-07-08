package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockProductGroupResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockVariantResponse;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Stateless mapping/formatting helpers extracted from {@link AdminInventoryService}.
 *
 * <p>These methods take plain arguments, reference no Spring bean / repository, and
 * perform pure DTO mapping, response formatting, state parsing, CSV escaping, and
 * audit-snapshot building. Stock mutation, movement writes, and repository
 * orchestration remain in the service.
 *
 * <p>Follows the {@code ProductFieldApplier} precedent: a package-private {@code final}
 * class of {@code public static} helpers with a private constructor and no Spring
 * annotation, consumed via {@code import static}.
 */
final class AdminInventoryMapper {

    private AdminInventoryMapper() {}

    static AdminStockProductGroupResponse toProductGroup(ProductEntity p) {
        List<ProductVariantEntity> variants = p.getVariants() != null ? p.getVariants() : List.of();

        AdminStockItemResponse.ImageRef img = buildProductImageRef(p);

        if (variants.isEmpty()) {
            boolean available = p.getStockState() != ProductStockState.OUT_OF_STOCK;
            return new AdminStockProductGroupResponse(
                    p.getId(), p.getName(), p.getNameEn(), p.getSku(), img,
                    p.getStockState() != null ? p.getStockState().name() : "UNKNOWN",
                    available,
                    p.getRetailPrice(),
                    Boolean.TRUE.equals(p.getForceOutOfStock()),
                    true,
                    List.of()
            );
        }

        List<AdminStockVariantResponse> variantDtos = variants.stream()
                .map(v -> new AdminStockVariantResponse(
                        v.getId(), v.getName(), v.getSku(),
                        v.getStockState() != null ? v.getStockState().name() : "UNKNOWN",
                        v.isAvailable(),
                        v.getRetailPrice()
                ))
                .toList();

        String aggregateState = computeAggregateState(variants);
        // Derived from the same aggregateState computation (stockState), not read independently
        // from isAvailable — the two were kept in sync by convention but nothing enforced it,
        // which is exactly how stockState/isAvailable drift (audit II-02) went undetected.
        boolean anyAvailable = "IN_STOCK".equals(aggregateState);
        BigDecimal minPrice = variants.stream()
                .map(v -> v.getRetailPrice())
                .filter(Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(p.getRetailPrice());

        return new AdminStockProductGroupResponse(
                p.getId(), p.getName(), p.getNameEn(), p.getSku(), img,
                aggregateState, anyAvailable, minPrice,
                Boolean.TRUE.equals(p.getForceOutOfStock()),
                false,
                variantDtos
        );
    }

    // Product-level aggregate of variant availability (BUSINESS_RULES STOCK_RULE_008,
    // boolean model since 2026-06-23). A product is IN_STOCK when ANY variant is
    // available, else OUT_OF_STOCK.
    static String computeAggregateState(List<ProductVariantEntity> variants) {
        boolean anyIn = variants.stream().anyMatch(v -> v.getStockState() == ProductStockState.IN_STOCK);
        return anyIn ? "IN_STOCK" : "OUT_OF_STOCK";
    }

    static AdminStockItemResponse.ImageRef buildProductImageRef(ProductEntity p) {
        String url = trimToNull(p.getImageUrl());
        if (url == null) return null;
        return new AdminStockItemResponse.ImageRef(
                trimToNull(p.getImageId()), url, trimToNull(p.getImageAlt()),
                p.getImageWidth(), p.getImageHeight(), trimToNull(p.getImageMimeType())
        );
    }

    static ProductStockState parseState(String stockState) {
        if (stockState == null || stockState.isBlank() || "ALL".equalsIgnoreCase(stockState)) return null;
        try { return ProductStockState.valueOf(stockState.toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException ignored) { return null; }
    }

    static AdminStockItemResponse toProductStockItem(ProductEntity p) {
        AdminStockItemResponse.ImageRef img = null;
        String url = trimToNull(p.getImageUrl());
        if (url != null) {
            img = new AdminStockItemResponse.ImageRef(
                    trimToNull(p.getImageId()),
                    url,
                    trimToNull(p.getImageAlt()),
                    p.getImageWidth(),
                    p.getImageHeight(),
                    trimToNull(p.getImageMimeType())
            );
        }
        return new AdminStockItemResponse(
                p.getId(),
                p.getName(),
                p.getSku(),
                img,
                null,
                null,
                null,
                p.getStockState() != null ? p.getStockState().name() : "UNKNOWN",
                p.getStockState() != ProductStockState.OUT_OF_STOCK,
                p.getRetailPrice(),
                Boolean.TRUE.equals(p.getForceOutOfStock())
        );
    }

    static AdminStockItemResponse toStockItem(ProductVariantEntity v) {
        return new AdminStockItemResponse(
                v.getProduct().getId(),
                v.getProduct().getName(),
                v.getProduct().getSku(),
                imageRef(v),
                v.getId(),
                v.getName(),
                v.getSku(),
                v.getStockState() != null ? v.getStockState().name() : "UNKNOWN",
                v.isAvailable(),
                v.getRetailPrice(),
                Boolean.TRUE.equals(v.getProduct().getForceOutOfStock())
        );
    }

    static AdminStockItemResponse.ImageRef imageRef(ProductVariantEntity v) {
        String variantUrl = trimToNull(v.getImageUrl());
        if (variantUrl != null) {
            return new AdminStockItemResponse.ImageRef(
                    trimToNull(v.getImageId()),
                    variantUrl,
                    trimToNull(v.getImageAlt()),
                    v.getImageWidth(),
                    v.getImageHeight(),
                    trimToNull(v.getImageMimeType())
            );
        }

        var product = v.getProduct();
        if (product == null) {
            return null;
        }

        String productUrl = trimToNull(product.getImageUrl());
        if (productUrl == null) {
            return null;
        }

        return new AdminStockItemResponse.ImageRef(
                trimToNull(product.getImageId()),
                productUrl,
                trimToNull(product.getImageAlt()),
                product.getImageWidth(),
                product.getImageHeight(),
                trimToNull(product.getImageMimeType())
        );
    }

    static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    static String csvEscape(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

}
