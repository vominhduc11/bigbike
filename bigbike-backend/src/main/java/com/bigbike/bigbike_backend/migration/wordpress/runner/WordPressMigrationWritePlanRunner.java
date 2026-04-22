package com.bigbike.bigbike_backend.migration.wordpress.runner;

import com.bigbike.bigbike_backend.migration.wordpress.config.WordPressMigrationProperties;
import com.bigbike.bigbike_backend.migration.wordpress.report.CatalogContentDryRunResult;
import com.bigbike.bigbike_backend.migration.wordpress.report.CustomerOrderCouponDryRunResult;
import com.bigbike.bigbike_backend.migration.wordpress.service.WordPressCatalogContentDryRunService;
import com.bigbike.bigbike_backend.migration.wordpress.service.WordPressCustomerOrderCouponDryRunService;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationWriteOperation;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationWritePlan;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.WordPressMigrationWritePlanService;
import java.nio.file.Files;
import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Phase 2D — Write plan runner.
 *
 * Activates when:
 *   bigbike.migration.wordpress.enabled=true
 *   bigbike.migration.wordpress.dry-run=true
 *   bigbike.migration.wordpress.mode=write-plan
 *
 * Safety: This runner NEVER writes to the application database.
 * It only reads the dump file and generates a plan report.
 */
@Component
public class WordPressMigrationWritePlanRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(WordPressMigrationWritePlanRunner.class);

    private final WordPressMigrationProperties props;
    private final WordPressCatalogContentDryRunService catalogDryRunService;
    private final WordPressCustomerOrderCouponDryRunService commerceDryRunService;
    private final WordPressMigrationWritePlanService writePlanService;

    public WordPressMigrationWritePlanRunner(
            WordPressMigrationProperties props,
            WordPressCatalogContentDryRunService catalogDryRunService,
            WordPressCustomerOrderCouponDryRunService commerceDryRunService,
            WordPressMigrationWritePlanService writePlanService) {
        this.props = props;
        this.catalogDryRunService = catalogDryRunService;
        this.commerceDryRunService = commerceDryRunService;
        this.writePlanService = writePlanService;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        // Guard 1: migration must be enabled
        if (!props.isEnabled()) return;
        // Guard 2: must be dry-run mode (write-plan never writes DB)
        if (!props.isDryRun()) return;
        // Guard 3: mode must be "write-plan"
        if (!"write-plan".equals(props.getMode())) return;

        log.info("=== Phase 2D: Write Plan Generation ===");
        log.info("Dump path: {}", props.resolvedDumpPath());

        String dumpPathStr = props.resolvedDumpPath();
        if (dumpPathStr == null || dumpPathStr.isBlank()) {
            log.error("Write plan aborted: dump path is not configured.");
            log.error("Set --bigbike.migration.wordpress.dump-path=<path>");
            return;
        }
        Path dumpPath = Path.of(dumpPathStr);
        if (!Files.exists(dumpPath)) {
            log.error("Write plan aborted: dump file not found: {}", dumpPath);
            return;
        }

        log.info("Step 1/3: Running catalog/content dry-run...");
        CatalogContentDryRunResult catalog = catalogDryRunService.run(dumpPath);

        log.info("Step 2/3: Running customer/order/coupon dry-run...");
        CustomerOrderCouponDryRunResult commerce = commerceDryRunService.run(dumpPath);

        log.info("Step 3/3: Generating write plan...");
        MigrationWritePlan plan = writePlanService.buildPlan(catalog, commerce);

        // ── Print plan to log ─────────────────────────────────────────────────
        log.info("");
        log.info("=== PHASE2D_WRITE_PLAN_BEGIN ===");
        log.info("Planned operations: {} total rows", plan.totalPlannedRows());
        log.info("  INSERT: {}", plan.totalInsert());
        log.info("  UPSERT: {}", plan.totalUpsert());
        log.info("  SKIP:   {}", plan.totalSkip());
        log.info("  DEFER:  {}", plan.totalDefer());
        log.info("");

        for (MigrationWriteOperation op : plan.operations()) {
            log.info("  [{} → {}] table={} strategy={} rows={}{}",
                    op.operationType(), op.domain(), op.targetTable(),
                    op.conflictStrategy(), op.estimatedRows(),
                    op.hasBlockers() ? " *** BLOCKED ***" : "");
            if (op.hasBlockers()) {
                for (String b : op.blockers()) log.warn("    BLOCKER: {}", b);
            }
        }

        log.info("");
        if (!plan.globalBlockers().isEmpty()) {
            log.warn("=== GLOBAL BLOCKERS ({}) ===", plan.globalBlockers().size());
            for (String b : plan.globalBlockers()) log.warn("  BLOCKER: {}", b);
        }
        if (!plan.globalWarnings().isEmpty()) {
            log.info("=== GLOBAL WARNINGS ({}) ===", plan.globalWarnings().size());
            for (String w : plan.globalWarnings()) log.info("  WARNING: {}", w);
        }

        log.info("Executable: {}", plan.isExecutable());
        log.info("=== PHASE2D_WRITE_PLAN_END ===");
        log.info("");
        log.info("No DB writes performed. This was a write-plan (dry-run) only.");
        log.info("To execute the import, use mode=import with dry-run=false and confirm-execute=true.");
        log.info("DO NOT run import mode without a full database backup and staging rehearsal.");
    }
}
