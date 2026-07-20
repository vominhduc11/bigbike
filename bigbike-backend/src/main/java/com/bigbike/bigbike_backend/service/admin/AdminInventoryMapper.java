package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockItemResponse;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import java.util.Locale;

/**
 * Stateless mapping/formatting helpers extracted from {@link AdminInventoryService}.
 *
 * <p>These methods take plain arguments, reference no Spring bean / repository, and
 * perform pure DTO mapping and state parsing.
 *
 * <p>Follows the {@code ProductFieldApplier} precedent: a package-private {@code final}
 * class of {@code public static} helpers with a private constructor and no Spring
 * annotation, consumed via {@code import static}.
 *
 * <p>The grouped-list and CSV-export helpers ({@code toProductGroup}, {@code csvEscape},
 * …) were removed 2026-07-15 together with their endpoints (AUD-056).
 */
final class AdminInventoryMapper {

    private AdminInventoryMapper() {}

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
                p.getRetailPrice()
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
                v.getRetailPrice()
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
}
