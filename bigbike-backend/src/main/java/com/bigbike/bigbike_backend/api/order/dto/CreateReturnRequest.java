package com.bigbike.bigbike_backend.api.order.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record CreateReturnRequest(
        @NotBlank String reason,
        String customerNote,
        @NotEmpty List<ReturnItemRequest> items
) {
    public record ReturnItemRequest(
            @NotNull UUID orderLineItemId,
            @Min(1) int quantity,
            String reason
    ) {}
}
