package com.bigbike.bigbike_backend.api.admin.dto.inventory;

import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockItemResponse.ImageRef;
import java.math.BigDecimal;
import java.util.List;

public record AdminStockProductGroupResponse(
        String productId,
        String productName,
        String productSku,
        ImageRef productImage,
        String aggregateStockState,
        int totalQuantity,
        BigDecimal minRetailPrice,
        boolean forceOutOfStock,
        boolean isNoVariant,
        boolean trackSerials,
        List<AdminStockVariantResponse> variants
) {}
