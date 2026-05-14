package com.bigbike.bigbike_backend.api.admin.dto.inventory;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record SerialImportRequest(
        @NotNull
        @Size(min = 1, max = 5000, message = "rows must contain between 1 and 5000 entries.")
        @Valid
        List<SerialImportRowRequest> rows,
        boolean partialMode   // false = all-or-nothing; true = skip bad rows, insert rest
) {}
