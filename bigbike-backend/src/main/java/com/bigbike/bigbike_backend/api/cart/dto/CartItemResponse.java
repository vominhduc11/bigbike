package com.bigbike.bigbike_backend.api.cart.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record CartItemResponse(
        UUID id,
        String productId,
        String productVariantId,
        String sku,
        String productName,
        String variantName,
        int quantity,
        BigDecimal unitPrice,
        BigDecimal lineSubtotal,
        BigDecimal lineDiscount,
        BigDecimal lineTotal
) {}
