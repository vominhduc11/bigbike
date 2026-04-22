package com.bigbike.bigbike_backend.migration.wordpress.report;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Accumulates dry-run migration statistics without writing to the production DB.
 * Call addDomain() for each domain, then build().
 */
public class MigrationDryRunReport {

    public record DomainStats(
            String domain,
            int sourceCount,
            int mappedCount,
            int skippedCount,
            List<String> warnings,
            List<String> unmappedFields
    ) {}

    public record ReportSummary(
            int totalSourceRows,
            int totalMapped,
            int totalSkipped,
            int totalWarnings,
            boolean dryRun,
            Map<String, DomainStats> byDomain
    ) {}

    private final Map<String, DomainStats> domains = new LinkedHashMap<>();
    private final boolean dryRun;

    public MigrationDryRunReport(boolean dryRun) {
        this.dryRun = dryRun;
    }

    public void addDomain(String name, int sourceCount, int mappedCount, int skippedCount,
            List<String> warnings, List<String> unmappedFields) {
        domains.put(name, new DomainStats(
                name, sourceCount, mappedCount, skippedCount,
                new ArrayList<>(warnings), new ArrayList<>(unmappedFields)
        ));
    }

    public ReportSummary build() {
        int totalSource = domains.values().stream().mapToInt(DomainStats::sourceCount).sum();
        int totalMapped = domains.values().stream().mapToInt(DomainStats::mappedCount).sum();
        int totalSkipped = domains.values().stream().mapToInt(DomainStats::skippedCount).sum();
        int totalWarnings = domains.values().stream()
                .mapToInt(d -> d.warnings().size()).sum();

        return new ReportSummary(totalSource, totalMapped, totalSkipped, totalWarnings, dryRun, domains);
    }
}
