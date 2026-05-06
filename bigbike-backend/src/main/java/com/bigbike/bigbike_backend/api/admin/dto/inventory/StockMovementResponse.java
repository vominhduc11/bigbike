package com.bigbike.bigbike_backend.api.admin.dto.inventory;

import java.time.Instant;
import java.util.UUID;

public record StockMovementResponse(
        UUID id,
        String movementType,
        int quantityDelta,
        int quantityBefore,
        int quantityAfter,
        String referenceType,
        String note,
        Instant createdAt,
        long serialCount,
        String productName,
        String variantName,
        String variantSku
) {}
