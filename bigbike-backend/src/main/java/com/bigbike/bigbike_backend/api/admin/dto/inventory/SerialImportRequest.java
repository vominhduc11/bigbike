package com.bigbike.bigbike_backend.api.admin.dto.inventory;

import java.util.List;

public record SerialImportRequest(
        List<SerialImportRowRequest> rows,
        boolean partialMode   // false = all-or-nothing; true = skip bad rows, insert rest
) {}
