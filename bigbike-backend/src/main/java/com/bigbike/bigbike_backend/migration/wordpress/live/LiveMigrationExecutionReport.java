package com.bigbike.bigbike_backend.migration.wordpress.live;

import java.time.Instant;
import java.util.Map;

record LiveMigrationExecutionReport(
        String runId,
        String snapshotId,
        Instant startedAt,
        Instant completedAt,
        boolean resumed,
        Map<String, DomainCounts> domains,
        Map<String, Long> protectedCountsBefore,
        Map<String, Long> protectedCountsAfter) {

    record DomainCounts(int inserted, int updated, int preserved, int skippedByCheckpoint) {
        DomainCounts add(DomainCounts other) {
            return new DomainCounts(
                    inserted + other.inserted,
                    updated + other.updated,
                    preserved + other.preserved,
                    skippedByCheckpoint + other.skippedByCheckpoint);
        }
    }
}
