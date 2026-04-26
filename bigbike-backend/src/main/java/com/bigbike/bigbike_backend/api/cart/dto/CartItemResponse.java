package com.bigbike.bigbike_backend.api.cart.dto;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import java.math.BigDecimal;
import java.util.UUID;

public record CartItemResponse(
        UUID id,
        String productId,
        String productVariantId,
        String sku,
        String productName,
        String variantName,
        ImageAsset image,
        int quantity,
        BigDecimal unitPrice,
        BigDecimal lineSubtotal,
        BigDecimal lineDiscount,
        BigDecimal lineTotal
) {}
