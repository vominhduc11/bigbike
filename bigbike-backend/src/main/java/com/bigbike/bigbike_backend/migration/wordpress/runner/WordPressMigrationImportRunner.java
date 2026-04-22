package com.bigbike.bigbike_backend.migration.wordpress.runner;

import com.bigbike.bigbike_backend.migration.wordpress.config.WordPressMigrationProperties;
import com.bigbike.bigbike_backend.migration.wordpress.importer.MigrationExecutionOptions;
import com.bigbike.bigbike_backend.migration.wordpress.importer.MigrationExecutionReport;
import com.bigbike.bigbike_backend.migration.wordpress.importer.WordPressMigrationImportService;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Phase 2D — Idempotent import runner.
 *
 * This runner has FOUR mandatory guards before it will write to the database.
 * ALL FOUR must be satisfied:
 *
 *   1. bigbike.migration.wordpress.enabled=true
 *   2. bigbike.migration.wordpress.dry-run=false
 *   3. bigbike.migration.wordpress.mode=import
 *   4. bigbike.migration.wordpress.confirm-execute=true
 *
 * Additional safety checks:
 *   - dump-path must exist and be readable
 *   - target Spring profile must NOT be "test"
 *
 * If ANY guard fails: runner is a complete no-op. No DB writes occur.
 *
 * Idempotency: Running the import multiple times produces the same result.
 * Each domain upserts by legacyId or natural key — no duplicate rows created.
 */
@Component
public class WordPressMigrationImportRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(WordPressMigrationImportRunner.class);

    private final WordPressMigrationProperties props;
    private final WordPressMigrationImportService importService;
    private final Environment environment;

    public WordPressMigrationImportRunner(
            WordPressMigrationProperties props,
            WordPressMigrationImportService importService,
            Environment environment) {
        this.props = props;
        this.importService = importService;
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        // Guard 1: master switch
        if (!props.isEnabled()) return;

        // Guard 2: must NOT be dry-run
        if (props.isDryRun()) return;

        // Guard 3: mode must be "import"
        if (!"import".equals(props.getMode())) return;

        // Guard 4: explicit confirmation flag required
        if (!props.isConfirmExecute()) {
            log.error("=================================================");
            log.error("IMPORT ABORTED: confirm-execute flag is NOT set.");
            log.error("To proceed, add: --bigbike.migration.wordpress.confirm-execute=true");
            log.error("NEVER run import on production without a full database backup.");
            log.error("=================================================");
            return;
        }

        // Safety: refuse to run in test profile
        boolean isTestProfile = Arrays.asList(environment.getActiveProfiles()).contains("test");
        if (isTestProfile) {
            log.error("IMPORT ABORTED: active Spring profile is 'test'. Real import must not run in test profile.");
            return;
        }

        // Safety: dump path must exist
        String dumpPathStr = props.resolvedDumpPath();
        if (dumpPathStr == null || dumpPathStr.isBlank()) {
            log.error("IMPORT ABORTED: dump path is not configured.");
            return;
        }
        Path dumpPath = Path.of(dumpPathStr);
        if (!Files.exists(dumpPath)) {
            log.error("IMPORT ABORTED: dump file not found: {}", dumpPath);
            return;
        }

        // Parse domain list
        Set<MigrationDomain> domains = parseDomains(props.getDomains());

        log.warn("=================================================");
        log.warn("PHASE 2D IMPORT: REAL DATABASE WRITES STARTING");
        log.warn("Dump:    {}", dumpPath);
        log.warn("Domains: {}", domains.isEmpty() ? "ALL" : domains);
        log.warn("Batch:   {}", props.getBatchSize());
        log.warn("=================================================");
        log.warn("This operation writes to the database. Ensure you have a backup.");

        MigrationExecutionOptions options = new MigrationExecutionOptions(
                dumpPath,
                domains,
                props.getBatchSize(),
                true,  // failFast=true for real import
                false  // dryRun=false
        );

        MigrationExecutionReport report = importService.run(options);

        log.info("=== PHASE2D_IMPORT_REPORT_BEGIN ===");
        log.info("Duration:  {}ms", report.duration().toMillis());
        log.info("Inserted:  {}", report.totalInserted());
        log.info("Updated:   {}", report.totalUpdated());
        log.info("Skipped:   {}", report.totalSkipped());
        log.info("Failed:    {}", report.totalFailed());
        log.info("HasErrors: {}", report.hasErrors());
        log.info("");

        for (var entry : report.byDomain().entrySet()) {
            MigrationExecutionReport.DomainResult dr = entry.getValue();
            log.info("  [{}] inserted={} updated={} skipped={} failed={}",
                    dr.domain(), dr.inserted(), dr.updated(), dr.skipped(), dr.failed());
            for (String err : dr.errors()) log.error("    ERROR: {}", err);
        }

        if (!report.globalErrors().isEmpty()) {
            log.error("=== GLOBAL ERRORS ===");
            for (String err : report.globalErrors()) log.error("  {}", err);
        }

        log.info("=== PHASE2D_IMPORT_REPORT_END ===");

        if (report.hasErrors()) {
            log.error("Import completed WITH ERRORS. Review the report above before proceeding.");
        } else {
            log.info("Import completed successfully. Run again to verify idempotency.");
        }
    }

    private Set<MigrationDomain> parseDomains(String domainsStr) {
        if (domainsStr == null || domainsStr.isBlank()) return Set.of();
        return Arrays.stream(domainsStr.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> {
                    try { return MigrationDomain.valueOf(s.toUpperCase()); }
                    catch (IllegalArgumentException e) {
                        log.warn("Unknown domain '{}' in domains config; ignoring.", s);
                        return null;
                    }
                })
                .filter(d -> d != null)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
