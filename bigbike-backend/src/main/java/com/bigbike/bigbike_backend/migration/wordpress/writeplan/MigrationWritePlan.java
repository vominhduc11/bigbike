package com.bigbike.bigbike_backend.migration.wordpress.writeplan;

import java.util.List;

public record MigrationWritePlan(
        List<MigrationWriteOperation> operations,
        List<String> globalBlockers,
        List<String> globalWarnings,
        int totalInsert,
        int totalUpsert,
        int totalSkip,
        int totalDefer) {

    public boolean isExecutable() {
        return globalBlockers.isEmpty()
                && operations.stream().noneMatch(MigrationWriteOperation::hasBlockers);
    }

    public int totalPlannedRows() {
        return totalInsert + totalUpsert;
    }
}
