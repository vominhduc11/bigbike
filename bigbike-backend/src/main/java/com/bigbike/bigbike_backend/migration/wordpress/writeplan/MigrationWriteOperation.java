package com.bigbike.bigbike_backend.migration.wordpress.writeplan;

import java.util.List;

public record MigrationWriteOperation(
        MigrationDomain domain,
        MigrationOperationType operationType,
        String targetTable,
        MigrationConflictStrategy conflictStrategy,
        int estimatedRows,
        List<String> warnings,
        List<String> blockers,
        String reason) {

    public boolean hasBlockers() {
        return blockers != null && !blockers.isEmpty();
    }

    public boolean hasWarnings() {
        return warnings != null && !warnings.isEmpty();
    }
}
