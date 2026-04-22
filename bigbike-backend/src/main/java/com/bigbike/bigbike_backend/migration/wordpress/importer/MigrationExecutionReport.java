package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import java.time.Duration;
import java.util.List;
import java.util.Map;

public record MigrationExecutionReport(
        boolean dryRun,
        Map<MigrationDomain, DomainResult> byDomain,
        List<String> globalErrors,
        Duration duration) {

    public int totalInserted() {
        return byDomain.values().stream().mapToInt(DomainResult::inserted).sum();
    }

    public int totalUpdated() {
        return byDomain.values().stream().mapToInt(DomainResult::updated).sum();
    }

    public int totalSkipped() {
        return byDomain.values().stream().mapToInt(DomainResult::skipped).sum();
    }

    public int totalFailed() {
        return byDomain.values().stream().mapToInt(DomainResult::failed).sum();
    }

    public boolean hasErrors() {
        return !globalErrors.isEmpty()
                || byDomain.values().stream().anyMatch(r -> r.failed() > 0);
    }

    public record DomainResult(
            MigrationDomain domain,
            int inserted,
            int updated,
            int skipped,
            int failed,
            List<String> warnings,
            List<String> errors) {

        public static DomainResult empty(MigrationDomain domain) {
            return new DomainResult(domain, 0, 0, 0, 0, List.of(), List.of());
        }
    }
}
