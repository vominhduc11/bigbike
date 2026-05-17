package com.bigbike.bigbike_backend.api.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record CreateReturnRequest(
        @NotBlank @Size(max = 500) String reason,
        @Size(max = 1000)
        String customerNote,
        @NotEmpty
        @Size(max = 50)
        List<@Valid ReturnItemRequest> items
) {
    public record ReturnItemRequest(
            @NotNull UUID orderLineItemId,
            @Min(1) int quantity,
            @Size(max = 500)
            String reason
    ) {}
}
