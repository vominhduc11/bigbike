package com.bigbike.bigbike_backend.api.order.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record OrderLineItemResponse(
        UUID id,
        UUID productId,
        UUID productVariantId,
        String sku,
        String productName,
        String variantName,
        int quantity,
        BigDecimal unitPrice,
        BigDecimal lineSubtotal,
        BigDecimal lineDiscount,
        BigDecimal lineTotal,
        // Resolved read-time from the current product image (not snapshotted) —
        // null when the product no longer exists. See DATA_CONTRACT.md.
        String productThumbnailUrl
) {}
