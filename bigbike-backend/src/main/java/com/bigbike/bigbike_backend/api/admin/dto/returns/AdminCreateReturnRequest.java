package com.bigbike.bigbike_backend.api.admin.dto.returns;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;
import java.util.UUID;

public record AdminCreateReturnRequest(
        @NotNull UUID orderId,
        @NotBlank String reason,
        String customerNote,
        @NotEmpty @Valid List<ReturnItemRequest> items
) {
    public record ReturnItemRequest(
            @NotNull UUID orderLineItemId,
            @NotNull @Positive Integer quantity,
            String reason
    ) {}
}
