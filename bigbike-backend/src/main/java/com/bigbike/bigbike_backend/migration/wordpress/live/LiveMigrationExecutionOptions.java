package com.bigbike.bigbike_backend.migration.wordpress.live;

import java.nio.file.Path;

record LiveMigrationExecutionOptions(
        Path reviewedPlanPath,
        String expectedReviewedPlanSha256,
        String executionConfirmation,
        int batchSize) {

    LiveMigrationExecutionOptions {
        if (batchSize < 1 || batchSize > 500) {
            throw new IllegalArgumentException("batchSize must be between 1 and 500");
        }
    }
}
