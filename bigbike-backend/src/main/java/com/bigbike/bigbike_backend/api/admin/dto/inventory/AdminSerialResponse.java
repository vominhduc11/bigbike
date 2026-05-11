package com.bigbike.bigbike_backend.api.admin.dto.inventory;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSerialEntity;
import java.time.Instant;
import java.util.UUID;

public record AdminSerialResponse(
        UUID id,
        String productId,
        String productName,
        String variantId,
        String variantName,
        String serialNumber,
        String status,
        Instant reservedUntil,
        UUID orderLineItemId,
        UUID returnItemId,
        Instant receivedAt,
        Instant soldAt,
        Instant returnedAt,
        String note,
        Instant createdAt,
        Instant updatedAt
) {
    public static AdminSerialResponse from(ProductSerialEntity s) {
        return new AdminSerialResponse(
                s.getId(),
                s.getProduct() != null ? s.getProduct().getId() : null,
                s.getProduct() != null ? s.getProduct().getName() : null,
                s.getVariant() != null ? s.getVariant().getId() : null,
                s.getVariant() != null ? s.getVariant().getName() : null,
                s.getSerialNumber(),
                s.getStatus() != null ? s.getStatus().name() : null,
                s.getReservedUntil(),
                s.getOrderLineItemId(),
                s.getReturnItemId(),
                s.getReceivedAt(),
                s.getSoldAt(),
                s.getReturnedAt(),
                s.getNote(),
                s.getCreatedAt(),
                s.getUpdatedAt()
        );
    }
}
