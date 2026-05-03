package com.bigbike.bigbike_backend.api.admin.dto.inventory;

import java.math.BigDecimal;

public record AdminStockItemResponse(
        String productId,
        String productName,
        String productSku,
        ImageRef productImage,
        String variantId,
        String variantName,
        String variantSku,
        String stockState,
        int quantityOnHand,
        BigDecimal retailPrice
) {
    public record ImageRef(
            String id,
            String url,
            String alt,
            Integer width,
            Integer height,
            String mimeType
    ) {}
}
