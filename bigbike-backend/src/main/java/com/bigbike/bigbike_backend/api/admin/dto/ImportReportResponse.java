package com.bigbike.bigbike_backend.api.admin.dto;

import java.util.List;

/** Summary + per-row detail returned by both the bulk-import dry-run and commit endpoints. */
public record ImportReportResponse(
        String mode,       // VALIDATE | COMMIT
        String fileType,    // csv | json
        int totalRows,
        int okCount,
        int warningCount,
        int errorCount,
        int skippedCount,
        List<ImportRowResult> rows
) {
}
