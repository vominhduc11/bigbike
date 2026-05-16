package com.bigbike.bigbike_backend.api.admin.dto.inventory;

import java.util.List;

public record SerialImportResponse(
        int inserted,
        int skipped,
        List<RowError> errors
) {
    public record RowError(int rowIndex, String field, String code, String message) {}
}
