package com.bigbike.bigbike_backend.api.admin.dto.inventory;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record AddSerialsRequest(
        @NotEmpty @Size(max = 500) @Valid List<SerialEntry> serials,
        @Size(max = 1000)
        String note
) {
    public record SerialEntry(
            @NotBlank
            @Size(max = 100)
            String serialNumber
    ) {}
}
