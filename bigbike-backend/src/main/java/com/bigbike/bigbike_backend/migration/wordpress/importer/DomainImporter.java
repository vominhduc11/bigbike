package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;

/**
 * Contract for per-domain idempotent importers.
 * Each implementation handles one domain's UPSERT logic.
 */
public interface DomainImporter {
    MigrationDomain domain();
    MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options);
}
