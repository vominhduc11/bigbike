package com.bigbike.bigbike_backend.api.admin.dto.inventory;

import java.math.BigDecimal;

public record AdminStockVariantResponse(
        String variantId,
        String variantName,
        String variantSku,
        String stockState,
        int quantityOnHand,
        BigDecimal retailPrice,
        boolean trackSerials
) {}
