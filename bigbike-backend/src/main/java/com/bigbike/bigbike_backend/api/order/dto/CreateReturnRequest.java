package com.bigbike.bigbike_backend.api.order.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreateReturnRequest(
        @NotBlank String reason,
        String customerNote,
        @NotEmpty List<ReturnItemRequest> items
) {
    public record ReturnItemRequest(
            UUID orderLineItemId,
            @NotBlank String productName,
            String variantName,
            String sku,
            int quantity,
            BigDecimal unitPrice,
            String reason
    ) {}
}
