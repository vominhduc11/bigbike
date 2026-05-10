package com.bigbike.bigbike_backend.api.admin.dto.inventory;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record AddSerialsRequest(
        @NotEmpty @Valid List<SerialEntry> serials,
        String note
) {
    public record SerialEntry(
            String chassisNumber,
            String engineNumber
    ) {}
}
