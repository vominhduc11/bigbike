package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockProductGroupResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockVariantResponse;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Stateless mapping/formatting helpers extracted from {@link AdminInventoryService}.
 *
 * <p>These methods take plain arguments, reference no Spring bean / repository, and
 * perform pure DTO mapping, response formatting, serial/state parsing, CSV escaping,
 * and audit-snapshot building. They are moved verbatim from the service; stock
 * mutation, serial lifecycle, movement writes, and repository orchestration remain
 * in the service.
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
            return new AdminStockProductGroupResponse(
                    p.getId(), p.getName(), p.getNameEn(), p.getSku(), img,
                    p.getStockState() != null ? p.getStockState().name() : "UNKNOWN",
                    p.getStockQuantity() != null ? p.getStockQuantity() : 0,
                    p.getRetailPrice(),
                    Boolean.TRUE.equals(p.getForceOutOfStock()),
                    true,
                    p.isTrackSerials(),
                    List.of()
            );
        }

        List<AdminStockVariantResponse> variantDtos = variants.stream()
                .map(v -> new AdminStockVariantResponse(
                        v.getId(), v.getName(), v.getSku(),
                        v.getStockState() != null ? v.getStockState().name() : "UNKNOWN",
                        v.getQuantityOnHand(),
                        v.getRetailPrice(),
                        v.isTrackSerials()
                ))
                .toList();

        String aggregateState = computeAggregateState(variants);
        int totalQty = variants.stream().mapToInt(v -> v.getQuantityOnHand()).sum();
        BigDecimal minPrice = variants.stream()
                .map(v -> v.getRetailPrice())
                .filter(Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(p.getRetailPrice());

        return new AdminStockProductGroupResponse(
                p.getId(), p.getName(), p.getNameEn(), p.getSku(), img,
                aggregateState, totalQty, minPrice,
                Boolean.TRUE.equals(p.getForceOutOfStock()),
                false,
                false,
                variantDtos
        );
    }

    // Product-level aggregate of variant stock states (BUSINESS_RULES STOCK_RULE_008,
    // kept in sync at write time by the V165 trigger). A product is only OUT_OF_STOCK
    // when ALL variants are out; if any variant still has stock the product is
    // IN_STOCK (any variant IN_STOCK) or LOW_STOCK (only low-stock variants remain).
    static String computeAggregateState(List<ProductVariantEntity> variants) {
        boolean anyIn = variants.stream().anyMatch(v -> v.getStockState() == ProductStockState.IN_STOCK);
        if (anyIn) return "IN_STOCK";
        boolean anyLow = variants.stream().anyMatch(v -> v.getStockState() == ProductStockState.LOW_STOCK);
        if (anyLow) return "LOW_STOCK";
        return "OUT_OF_STOCK";
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

    /**
     * Trim, de-blank, and de-duplicate serial numbers from the request.
     * Throws ValidationException if duplicates are found within the list.
     */
    static List<String> parseSerials(List<String> raw) {
        if (raw == null || raw.isEmpty()) return List.of();

        List<String> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        for (String entry : raw) {
            if (entry == null) continue;
            String trimmed = entry.strip();
            if (trimmed.isEmpty()) continue;
            if (!seen.add(trimmed)) {
                throw ValidationException.fromField("serialNumbers", "DUPLICATE_IN_REQUEST",
                        "Duplicate serial number in request: " + trimmed);
            }
            result.add(trimmed);
        }
        return result;
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
                p.getStockQuantity() != null ? p.getStockQuantity() : 0,
                p.getRetailPrice(),
                p.isTrackSerials(),
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
                v.getQuantityOnHand(),
                v.getRetailPrice(),
                v.isTrackSerials(),
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

    static AuditLogEntity buildAudit(UUID actorId, String action, String resourceType, String afterData) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(actorId);
        log.setAction(action);
        log.setResourceType(resourceType);
        log.setAfterData(afterData);
        log.setCreatedAt(Instant.now());
        return log;
    }
}
