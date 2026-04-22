package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import java.nio.file.Path;
import java.util.Set;

public record MigrationExecutionOptions(
        Path dumpPath,
        Set<MigrationDomain> domains,
        int batchSize,
        boolean failFast,
        boolean dryRun) {

    public boolean includesDomain(MigrationDomain domain) {
        return domains == null || domains.isEmpty() || domains.contains(domain);
    }
}
