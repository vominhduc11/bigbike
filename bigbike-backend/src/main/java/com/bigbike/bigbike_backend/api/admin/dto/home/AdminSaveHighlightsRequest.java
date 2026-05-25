package com.bigbike.bigbike_backend.api.admin.dto.home;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record AdminSaveHighlightsRequest(
        @NotNull @Valid @Size(min = 1, max = 3) List<SlotInput> slots
) {
    public record SlotInput(
            @NotNull @Min(1) @Max(3) Integer slot,
            @NotBlank @Size(max = 64) String productId
    ) {}
}
