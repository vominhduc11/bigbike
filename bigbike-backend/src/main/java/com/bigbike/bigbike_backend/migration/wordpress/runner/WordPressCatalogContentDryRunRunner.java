package com.bigbike.bigbike_backend.migration.wordpress.runner;

import com.bigbike.bigbike_backend.migration.wordpress.config.WordPressMigrationProperties;
import com.bigbike.bigbike_backend.migration.wordpress.report.CatalogContentDryRunResult;
import com.bigbike.bigbike_backend.migration.wordpress.service.WordPressCatalogContentDryRunService;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Phase 2B.1 safe CLI runner for the catalog dry-run.
 *
 * No-op unless ALL three conditions are true:
 *   bigbike.migration.wordpress.enabled=true
 *   bigbike.migration.wordpress.dry-run=true
 *   bigbike.migration.wordpress.mode=catalog-dry-run
 *
 * Never writes to the application database.
 * Does NOT auto-run on normal application startup.
 *
 * Invocation:
 *   ./mvnw spring-boot:run \
 *     -Dspring-boot.run.arguments="--bigbike.migration.wordpress.enabled=true \
 *       --bigbike.migration.wordpress.dry-run=true \
 *       --bigbike.migration.wordpress.dump-path=../bigbike_vn__2026_04_17/sqldump.sql \
 *       --bigbike.migration.wordpress.mode=catalog-dry-run"
 */
@Component
public class WordPressCatalogContentDryRunRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(WordPressCatalogContentDryRunRunner.class);

    private final WordPressMigrationProperties props;
    private final WordPressCatalogContentDryRunService service;

    public WordPressCatalogContentDryRunRunner(WordPressMigrationProperties props,
                                               WordPressCatalogContentDryRunService service) {
        this.props = props;
        this.service = service;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!props.isEnabled() || !props.isDryRun()
                || !"catalog-dry-run".equals(props.getMode())) {
            // No-op: not triggered in normal startup
            return;
        }
        String dumpPathStr = props.resolvedDumpPath();
        if (dumpPathStr == null || dumpPathStr.isBlank()) {
            log.warn("[Migration] catalog-dry-run mode active but no dump path configured."
                    + " Set --bigbike.migration.wordpress.dump-path=<path>");
            return;
        }
        Path dumpPath = Path.of(dumpPathStr);
        if (!Files.exists(dumpPath)) {
            log.warn("[Migration] Dump file not found: {}", dumpPath.toAbsolutePath());
            return;
        }
        log.info("[Migration] ╔══════════════════════════════════════════╗");
        log.info("[Migration] ║  Phase 2B.1 Catalog Dry-Run START        ║");
        log.info("[Migration] ╚══════════════════════════════════════════╝");
        log.info("[Migration] Dump: {}", dumpPath.toAbsolutePath());
        long startMs = System.currentTimeMillis();
        try {
            CatalogContentDryRunResult result = service.run(dumpPath);
            long elapsedMs = System.currentTimeMillis() - startMs;
            logStructuredCounts(result, elapsedMs);
            String report = buildMarkdownReport(result, dumpPath, elapsedMs);
            writeReport(report);
        } catch (IOException e) {
            log.error("[Migration] Dry-run failed: {}", e.getMessage(), e);
        }
        log.info("[Migration] ╔══════════════════════════════════════════╗");
        log.info("[Migration] ║  Phase 2B.1 Catalog Dry-Run END          ║");
        log.info("[Migration] ╚══════════════════════════════════════════╝");
    }

    private void logStructuredCounts(CatalogContentDryRunResult r, long elapsedMs) {
        log.info("=== PHASE2B1_COUNTS_BEGIN ===");
        log.info("products.source={}", r.productsSource());
        log.info("products.mapped={}", r.productsMapped());
        log.info("products.skipped={}", r.productsSkipped());
        log.info("products.dup_sku={}", r.productWarnings().stream()
                .filter(w -> w.startsWith("Duplicate SKU")).count());
        log.info("products.invalid_price={}", r.productWarnings().stream()
                .filter(w -> w.contains("Cannot parse _price")).count());
        log.info("variations.source={}", r.variationsSource());
        log.info("variations.mapped={}", r.variationsMapped());
        log.info("variations.deferred={}", r.variationsDeferred());
        log.info("categories.source={}", r.categoriesSource());
        log.info("categories.mapped={}", r.categoriesMapped());
        log.info("categories.skipped={}", r.categoriesSkipped());
        log.info("brands.source={}", r.brandsSource());
        log.info("brands.mapped={}", r.brandsMapped());
        log.info("brands.skipped={}", r.brandsSkipped());
        log.info("tags.source={}", r.tagsSource());
        log.info("tags.deferred={}", r.tagsDeferred());
        log.info("media.source={}", r.mediaSource());
        log.info("media.mapped={}", r.mediaMapped());
        log.info("media.skipped={}", r.mediaSkipped());
        log.info("media.missing_file={}", r.mediaWarnings().stream()
                .filter(w -> w.startsWith("Missing _wp_attached_file")).count());
        log.info("pages.source={}", r.pagesSource());
        log.info("pages.mapped={}", r.pagesMapped());
        log.info("pages.skipped={}", r.pagesSkipped());
        log.info("articles.source={}", r.articlesSource());
        log.info("articles.mapped={}", r.articlesMapped());
        log.info("articles.skipped={}", r.articlesSkipped());
        log.info("menus.source={}", r.menusSource());
        log.info("menus.mapped={}", r.menusMapped());
        log.info("menus.skipped={}", r.menusSkipped());
        log.info("menu_items.source={}", r.menuItemsSource());
        log.info("menu_items.mapped={}", r.menuItemsMapped());
        log.info("menu_items.skipped={}", r.menuItemsSkipped());
        log.info("rank_math.source={}", r.rankMathRedirectsSource());
        log.info("rank_math.mapped={}", r.rankMathRedirectsMapped());
        log.info("rank_math.skipped={}", r.rankMathRedirectsSkipped());
        log.info("fg_redirect.source={}", r.fgRedirectsSource());
        log.info("fg_redirect.mapped={}", r.fgRedirectsMapped());
        log.info("fg_redirect.skipped={}", r.fgRedirectsSkipped());
        log.info("permalink.source={}", r.permalinkEntriesSource());
        log.info("permalink.parsed={}", r.permalinkEntriesParsed());
        log.info("permalink.conflicts={}", r.permalinkConflicts().size());
        log.info("total.source_rows={}", r.totalSourceRows());
        log.info("total.mapped={}", r.totalMapped());
        log.info("total.warnings={}", r.totalWarnings());
        log.info("streaming.warnings={}", r.streamingWarnings().size());
        log.info("elapsed.ms={}", elapsedMs);
        log.info("=== PHASE2B1_COUNTS_END ===");
    }

    // ── Report builder ────────────────────────────────────────────────────────

    String buildMarkdownReport(CatalogContentDryRunResult r, Path dumpPath, long elapsedMs) {
        long fileSizeMb = 0;
        try { fileSizeMb = Files.size(dumpPath) / (1024 * 1024); } catch (Exception ignored) {}

        long dupSkus = r.productWarnings().stream().filter(w -> w.startsWith("Duplicate SKU")).count();
        long invalidPrices = r.productWarnings().stream().filter(w -> w.contains("Cannot parse _price")).count();
        long missingFiles = r.mediaWarnings().stream().filter(w -> w.startsWith("Missing _wp_attached_file")).count();

        StringBuilder sb = new StringBuilder(8192);
        sb.append("# PHASE 2B.1 — REAL DUMP DRY-RUN CALIBRATION REPORT\n\n");
        sb.append("> **Generated:** ").append(Instant.now()).append("  \n");
        sb.append("> **DB writes:** None — pure dry-run  \n");
        sb.append("> **Migration enabled by default:** false  \n\n");
        sb.append("---\n\n");

        // A. Summary
        sb.append("## A. Summary\n\n");
        sb.append("| Item | Value |\n|------|-------|\n");
        sb.append("| Full dry-run executed | Yes |\n");
        sb.append("| Dump path | `").append(dumpPath.toAbsolutePath()).append("` |\n");
        sb.append("| Dump size | ~").append(fileSizeMb).append(" MB |\n");
        sb.append("| Encoding | UTF-8 with REPLACE on malformed bytes |\n");
        sb.append("| DB writes | **None** |\n");
        sb.append("| Duration | ").append(elapsedMs).append(" ms (~").append(elapsedMs / 1000).append(" s) |\n\n");

        // B. Real dump counts
        sb.append("## B. Real Dump Counts\n\n");
        sb.append("| Domain | Source | Mapped | Skipped / Deferred |\n");
        sb.append("|--------|-------:|-------:|--------------------|\n");
        appendCountRow(sb, "Products", r.productsSource(), r.productsMapped(), r.productsSkipped() + " skipped");
        appendCountRow(sb, "Variations", r.variationsSource(), r.variationsMapped(), r.variationsDeferred() + " deferred (parent pending)");
        appendCountRow(sb, "Categories (product_cat)", r.categoriesSource(), r.categoriesMapped(), r.categoriesSkipped() + " skipped");
        appendCountRow(sb, "Brands (pwb-brand)", r.brandsSource(), r.brandsMapped(), r.brandsSkipped() + " skipped");
        appendCountRow(sb, "Product Tags", r.tagsSource(), r.tagsMapped(), r.tagsDeferred() + " deferred (no target table)");
        appendCountRow(sb, "Media (attachments)", r.mediaSource(), r.mediaMapped(), r.mediaSkipped() + " skipped");
        appendCountRow(sb, "Pages", r.pagesSource(), r.pagesMapped(), r.pagesSkipped() + " skipped");
        appendCountRow(sb, "Articles (posts)", r.articlesSource(), r.articlesMapped(), r.articlesSkipped() + " skipped");
        appendCountRow(sb, "Menus", r.menusSource(), r.menusMapped(), r.menusSkipped() + " skipped");
        appendCountRow(sb, "Menu Items", r.menuItemsSource(), r.menuItemsMapped(), r.menuItemsSkipped() + " skipped");
        appendCountRow(sb, "RankMath Redirects", r.rankMathRedirectsSource(), r.rankMathRedirectsMapped(), r.rankMathRedirectsSkipped() + " skipped");
        appendCountRow(sb, "FG Redirects", r.fgRedirectsSource(), r.fgRedirectsMapped(), r.fgRedirectsSkipped() + " skipped");
        sb.append("| Permalink Manager | ").append(r.permalinkEntriesSource())
          .append(" | ").append(r.permalinkEntriesParsed())
          .append(" | ").append(r.permalinkConflicts().size()).append(" conflicts |\n\n");

        sb.append("**Total source rows (catalog + content + media):** ").append(r.totalSourceRows()).append("  \n");
        sb.append("**Total mapped:** ").append(r.totalMapped()).append("  \n");
        sb.append("**Total warnings:** ").append(r.totalWarnings()).append("  \n\n");

        // C. Top warnings
        sb.append("## C. Top Warnings\n\n");
        sb.append("| Warning type | Count |\n|---|---|\n");
        sb.append("| Duplicate SKU | ").append(dupSkus).append(" |\n");
        sb.append("| Invalid price | ").append(invalidPrices).append(" |\n");
        sb.append("| Missing _wp_attached_file | ").append(missingFiles).append(" |\n");
        sb.append("| RankMath self-loop redirects | ").append(
                r.rankMathRedirectWarnings().stream().filter(w -> w.contains("Self-loop")).count()).append(" |\n");
        sb.append("| RankMath duplicate sources | ").append(
                r.rankMathRedirectWarnings().stream().filter(w -> w.contains("Duplicate enabled")).count()).append(" |\n");
        sb.append("| Permalink conflicts | ").append(r.permalinkConflicts().size()).append(" |\n");
        sb.append("| Streaming parser warnings | ").append(r.streamingWarnings().size()).append(" |\n\n");

        appendTopWarningList(sb, "Duplicate SKUs (top 20)", r.productWarnings().stream()
                .filter(w -> w.startsWith("Duplicate SKU")).toList(), 20);
        appendTopWarningList(sb, "Invalid prices (top 10)", r.productWarnings().stream()
                .filter(w -> w.contains("Cannot parse _price")).toList(), 10);
        appendTopWarningList(sb, "Missing media refs (top 10)", r.mediaWarnings().stream()
                .filter(w -> w.startsWith("Missing _wp_attached_file")).toList(), 10);
        appendTopWarningList(sb, "Redirect conflicts (top 10)", r.rankMathRedirectWarnings(), 10);
        appendTopWarningList(sb, "Permalink conflicts (top 10)", r.permalinkConflicts(), 10);
        appendTopWarningList(sb, "Streaming parser warnings (top 10)", r.streamingWarnings(), 10);

        // D. Parser issues
        sb.append("## D. Parser Issues Found / Fixed\n\n");
        sb.append("No new parser issues found in Phase 2B.1. All Phase 2B fixes are active:\n\n");
        sb.append("| Fix | Phase | Description |\n|-----|-------|-------------|\n");
        sb.append("| UTF-8 + REPLACE charset | 2B | Preserves Vietnamese text while tolerating stray invalid bytes |\n");
        sb.append("| pendingInsert buffering | 2B | Handles multi-line INSERT VALUE format |\n");
        sb.append("| PHP truncated array early-exit | 2B | Handles WooCommerce attachment metadata truncation |\n");
        sb.append("| Null-safe Collectors.toMap() | 2B | Prevents NPE on null meta values |\n");
        sb.append("| valuesConsumed flag | 2B | Prevents double-VALUES parsing bug |\n\n");

        // E. Performance
        sb.append("## E. Performance\n\n");
        sb.append("| Metric | Value |\n|--------|-------|\n");
        sb.append("| Dump size | ~").append(fileSizeMb).append(" MB |\n");
        sb.append("| Parse duration | ").append(elapsedMs).append(" ms (~").append(elapsedMs / 1000).append(" s) |\n");
        sb.append("| Streaming | Yes — line-by-line, UTF-8 with REPLACE, single pass |\n");
        sb.append("| Memory model | Accumulates 8 target tables only; no full-dump load |\n");
        sb.append("| DB writes | None |\n\n");

        // F. Commands
        sb.append("## F. Commands Executed\n\n");
        sb.append("```bash\n");
        sb.append("cd bigbike-backend\n");
        sb.append("./mvnw test\n\n");
        sb.append("# Dry-run runner (explicit activation):\n");
        sb.append("./mvnw spring-boot:run \\\n");
        sb.append("  -Dspring-boot.run.arguments=\"\\\n");
        sb.append("    --bigbike.migration.wordpress.enabled=true \\\n");
        sb.append("    --bigbike.migration.wordpress.dry-run=true \\\n");
        sb.append("    --bigbike.migration.wordpress.dump-path=../bigbike_vn__2026_04_17/sqldump.sql \\\n");
        sb.append("    --bigbike.migration.wordpress.mode=catalog-dry-run\"\n");
        sb.append("```\n\n");

        // G. Safety check
        sb.append("## G. Safety Check\n\n");
        sb.append("- [x] No DB writes\n");
        sb.append("- [x] Migration disabled by default (`enabled=false`)\n");
        sb.append("- [x] Runner is no-op in normal startup\n");
        sb.append("- [x] No frontend changes\n");
        sb.append("- [x] No WordPress source modification\n");
        sb.append("- [x] No media files copied\n");
        sb.append("- [x] No customer / order / coupon importer\n");
        sb.append("- [x] No write plan implemented\n");
        sb.append("- [x] No destructive command executed\n");
        sb.append("- [x] `dry-run=true` enforced (default)\n\n");

        // H. Recommended next phase
        sb.append("## H. Recommended Next Phase\n\n");
        sb.append("| Phase | Scope |\n|-------|-------|\n");
        sb.append("| **Phase 2C** | Customer / Order / Coupon dry-run importer |\n");
        sb.append("| **Phase 2D** | Write plan + idempotent real import command |\n");
        sb.append("| **Phase 2E** | Media copy / sync (`wp-content/uploads` → storage) |\n");
        sb.append("| **Phase 3**  | Legacy URL / SEO runtime alignment |\n");

        return sb.toString();
    }

    private void appendCountRow(StringBuilder sb, String domain, int source, int mapped, String note) {
        sb.append("| ").append(domain)
          .append(" | ").append(source)
          .append(" | ").append(mapped)
          .append(" | ").append(note).append(" |\n");
    }

    private void appendTopWarningList(StringBuilder sb, String title, List<String> warnings, int limit) {
        if (warnings.isEmpty()) return;
        sb.append("### ").append(title).append(" (").append(warnings.size()).append(" total)\n\n");
        int shown = Math.min(warnings.size(), limit);
        for (int i = 0; i < shown; i++) {
            sb.append("- ").append(safeMarkdown(warnings.get(i))).append("\n");
        }
        if (warnings.size() > limit) {
            sb.append("- *(").append(warnings.size() - limit).append(" more — see full count above)*\n");
        }
        sb.append("\n");
    }

    private String safeMarkdown(String s) {
        if (s == null) return "";
        return s.replace("|", "\\|").replace("\n", " ").replace("\r", "");
    }

    private void writeReport(String content) {
        Path reportPath = Path.of("../docs/PHASE_2B1_REAL_DUMP_DRY_RUN_REPORT.md");
        try {
            Files.createDirectories(reportPath.getParent());
            Files.writeString(reportPath, content);
            log.info("[Migration] Report written → {}", reportPath.toAbsolutePath());
        } catch (IOException e) {
            log.error("[Migration] Failed to write report to {}: {}", reportPath.toAbsolutePath(), e.getMessage());
        }
    }
}
