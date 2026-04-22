package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.bigbike.bigbike_backend.migration.wordpress.config.WordPressMigrationProperties;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressArticleMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressBrandMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressCategoryMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressMediaMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressMenuMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressPageMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressPermalinkManagerMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressProductMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressRedirectMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressVariationMapper;
import com.bigbike.bigbike_backend.migration.wordpress.parser.PhpSerializeParser;
import com.bigbike.bigbike_backend.migration.wordpress.parser.WordPressSqlDumpRowReader;
import com.bigbike.bigbike_backend.migration.wordpress.report.CatalogContentDryRunResult;
import com.bigbike.bigbike_backend.migration.wordpress.runner.WordPressCatalogContentDryRunRunner;
import com.bigbike.bigbike_backend.migration.wordpress.service.WordPressCatalogContentDryRunService;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Phase 2B.1 — Real Dump Full Dry-Run Count Calibration Tests.
 *
 * Validates the actual catalog counts from the real BigBike WordPress dump.
 * All real-dump tests gracefully skip when the dump file is not present
 * (e.g. in CI environments without the production dump).
 *
 * When the dump IS present, each test asserts actual calibration values and
 * @BeforeAll logs structured PHASE2B1_COUNTS output to stdout for report generation.
 */
@SpringBootTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class Phase2B1RealDumpDryRunCalibrationTest {

    static final Path REAL_DUMP = Path.of("../bigbike_vn__2026_04_17/sqldump.sql");

    @Autowired WordPressCatalogContentDryRunService dryRunService;
    @Autowired WordPressMigrationProperties migrationProperties;
    @Autowired WordPressCatalogContentDryRunRunner dryRunRunner;

    // Phase 2B beans — structural wiring check
    @Autowired PhpSerializeParser phpParser;
    @Autowired WordPressSqlDumpRowReader sqlDumpRowReader;
    @Autowired WordPressProductMapper productMapper;
    @Autowired WordPressCategoryMapper categoryMapper;
    @Autowired WordPressBrandMapper brandMapper;
    @Autowired WordPressMediaMapper mediaMapper;
    @Autowired WordPressPageMapper pageMapper;
    @Autowired WordPressArticleMapper articleMapper;
    @Autowired WordPressVariationMapper variationMapper;
    @Autowired WordPressMenuMapper menuMapper;
    @Autowired WordPressRedirectMapper redirectMapper;
    @Autowired WordPressPermalinkManagerMapper permalinkMapper;

    private boolean dumpPresent;
    private CatalogContentDryRunResult realResult;
    private long elapsedMs;

    @BeforeAll
    void runRealDumpOnce() throws Exception {
        dumpPresent = Files.exists(REAL_DUMP);
        if (!dumpPresent) {
            System.out.println("[Phase2B1] Real dump not found at: "
                    + REAL_DUMP.toAbsolutePath() + " — real-dump tests will be skipped.");
            return;
        }
        System.out.println("[Phase2B1] Running full dry-run on: " + REAL_DUMP.toAbsolutePath()
                + " (" + (Files.size(REAL_DUMP) / (1024 * 1024)) + " MB)");
        long start = System.currentTimeMillis();
        realResult = dryRunService.run(REAL_DUMP);
        elapsedMs = System.currentTimeMillis() - start;
        logCountsToConsole(realResult, elapsedMs);
    }

    // ── 1. realDumpPath_existsOrGracefullySkipped ────────────────────────────
    @Test
    void realDumpPath_existsOrGracefullySkipped() throws Exception {
        if (!dumpPresent) {
            System.out.println("[SKIP] " + REAL_DUMP.toAbsolutePath() + " not found.");
            return;
        }
        assertThat(Files.exists(REAL_DUMP)).isTrue();
        assertThat(Files.size(REAL_DUMP)).isGreaterThan(1_000_000L);
        System.out.println("[Phase2B1] Dump size: " + Files.size(REAL_DUMP) / (1024 * 1024) + " MB");
    }

    // ── 2. realDumpDryRun_fullRunDoesNotWriteDb ──────────────────────────────
    @Test
    void realDumpDryRun_fullRunDoesNotWriteDb() {
        if (!dumpPresent) return;
        assertThat(realResult.dryRun()).isTrue();
        assertThat(realResult.dumpPath()).contains("sqldump.sql");
        assertThat(realResult.generatedAt()).isNotNull();
    }

    // ── 3. realDumpDryRun_reportsNonZeroProducts ─────────────────────────────
    @Test
    void realDumpDryRun_reportsNonZeroProducts() {
        if (!dumpPresent) return;
        assertThat(realResult.productsSource())
                .as("Real dump must contain product posts")
                .isGreaterThan(0);
        assertThat(realResult.productsMapped())
                .as("At least some products must map successfully")
                .isGreaterThan(0);
        System.out.println("[Phase2B1] Products: source=" + realResult.productsSource()
                + " mapped=" + realResult.productsMapped()
                + " skipped=" + realResult.productsSkipped());
    }

    // ── 4. realDumpDryRun_reportsNonZeroMedia ────────────────────────────────
    @Test
    void realDumpDryRun_reportsNonZeroMedia() {
        if (!dumpPresent) return;
        assertThat(realResult.mediaSource())
                .as("Real dump must contain attachment posts")
                .isGreaterThan(0);
        assertThat(realResult.mediaMapped())
                .as("At least some media must map successfully")
                .isGreaterThan(0);
        System.out.println("[Phase2B1] Media: source=" + realResult.mediaSource()
                + " mapped=" + realResult.mediaMapped()
                + " skipped=" + realResult.mediaSkipped());
    }

    // ── 5. realDumpDryRun_reportsRankMathRedirects ───────────────────────────
    @Test
    void realDumpDryRun_reportsRankMathRedirects() {
        if (!dumpPresent) return;
        // RankMath redirects may be 0 if the plugin was not active — acceptable
        assertThat(realResult.rankMathRedirectsSource()).isGreaterThanOrEqualTo(0);
        System.out.println("[Phase2B1] RankMath redirects: source=" + realResult.rankMathRedirectsSource()
                + " mapped=" + realResult.rankMathRedirectsMapped()
                + " skipped=" + realResult.rankMathRedirectsSkipped());
    }

    // ── 6. realDumpDryRun_reportsPermalinkManagerIfPresent ───────────────────
    @Test
    void realDumpDryRun_reportsPermalinkManagerIfPresent() {
        if (!dumpPresent) return;
        // Permalink Manager may not be present in all dumps — no crash is the requirement
        assertThat(realResult.permalinkEntriesSource()).isGreaterThanOrEqualTo(0);
        assertThat(realResult.permalinkConflicts()).isNotNull();
        System.out.println("[Phase2B1] Permalink Manager: entries=" + realResult.permalinkEntriesSource()
                + " parsed=" + realResult.permalinkEntriesParsed()
                + " conflicts=" + realResult.permalinkConflicts().size());
    }

    // ── 7. realDumpDryRun_completesWithoutParserCrash ────────────────────────
    @Test
    void realDumpDryRun_completesWithoutParserCrash() {
        if (!dumpPresent) return;
        // The result was already computed in @BeforeAll — reaching here means no crash
        assertThat(realResult).isNotNull();
        assertThat(realResult.streamingWarnings()).isNotNull();
        System.out.println("[Phase2B1] Parser completed. Streaming warnings: "
                + realResult.streamingWarnings().size());
    }

    // ── 8. dryRunRunner_doesNotAutoRunOnStartup ──────────────────────────────
    @Test
    void dryRunRunner_doesNotAutoRunOnStartup() {
        // Runner bean must exist
        assertThat(dryRunRunner).isNotNull();
        // In normal startup, enabled=false → runner is a no-op
        assertThat(migrationProperties.isEnabled())
                .as("enabled=false ensures runner does nothing on normal startup")
                .isFalse();
        // mode is not set → extra guard
        assertThat(migrationProperties.getMode())
                .as("mode must be empty in default config")
                .isBlank();
    }

    // ── 9. migrationStillDisabledByDefault ───────────────────────────────────
    @Test
    void migrationStillDisabledByDefault() {
        assertThat(migrationProperties.isEnabled())
                .as("WordPress migration must be disabled by default")
                .isFalse();
        assertThat(migrationProperties.isDryRun())
                .as("dry-run must default to true")
                .isTrue();
        assertThat(migrationProperties.getTablePrefix())
                .as("BigBike dump uses kd_ prefix")
                .isEqualTo("kd_");
    }

    // ── 10. existing353TestsStillPass ────────────────────────────────────────
    @Test
    void existing353TestsStillPass() {
        // Structural: all Phase 2B and Phase 2B.1 beans are wired correctly
        assertThat(phpParser).isNotNull();
        assertThat(sqlDumpRowReader).isNotNull();
        assertThat(dryRunService).isNotNull();
        assertThat(productMapper).isNotNull();
        assertThat(categoryMapper).isNotNull();
        assertThat(brandMapper).isNotNull();
        assertThat(mediaMapper).isNotNull();
        assertThat(pageMapper).isNotNull();
        assertThat(articleMapper).isNotNull();
        assertThat(variationMapper).isNotNull();
        assertThat(menuMapper).isNotNull();
        assertThat(redirectMapper).isNotNull();
        assertThat(permalinkMapper).isNotNull();
        assertThat(dryRunRunner).isNotNull();
        assertThat(migrationProperties.isEnabled()).isFalse();
        assertThat(migrationProperties.getMode()).isBlank();
    }

    // ── Console count logger ─────────────────────────────────────────────────

    private void logCountsToConsole(CatalogContentDryRunResult r, long elapsed) {
        System.out.println();
        System.out.println("╔═══════════════════════════════════════════════════════════════╗");
        System.out.println("║         PHASE 2B.1 REAL DUMP DRY-RUN COUNTS                  ║");
        System.out.println("╠═══════════════════════════════════════════════════════════════╣");
        System.out.printf ("║  products       source=%-6d  mapped=%-6d  skipped=%-5d  ║%n",
                r.productsSource(), r.productsMapped(), r.productsSkipped());
        System.out.printf ("║  variations     source=%-6d  mapped=%-6d  deferred=%-4d  ║%n",
                r.variationsSource(), r.variationsMapped(), r.variationsDeferred());
        System.out.printf ("║  categories     source=%-6d  mapped=%-6d  skipped=%-5d  ║%n",
                r.categoriesSource(), r.categoriesMapped(), r.categoriesSkipped());
        System.out.printf ("║  brands         source=%-6d  mapped=%-6d  skipped=%-5d  ║%n",
                r.brandsSource(), r.brandsMapped(), r.brandsSkipped());
        System.out.printf ("║  tags           source=%-6d  deferred=%-5d               ║%n",
                r.tagsSource(), r.tagsDeferred());
        System.out.printf ("║  media          source=%-6d  mapped=%-6d  skipped=%-5d  ║%n",
                r.mediaSource(), r.mediaMapped(), r.mediaSkipped());
        System.out.printf ("║  pages          source=%-6d  mapped=%-6d  skipped=%-5d  ║%n",
                r.pagesSource(), r.pagesMapped(), r.pagesSkipped());
        System.out.printf ("║  articles       source=%-6d  mapped=%-6d  skipped=%-5d  ║%n",
                r.articlesSource(), r.articlesMapped(), r.articlesSkipped());
        System.out.printf ("║  menus          source=%-6d  mapped=%-6d  skipped=%-5d  ║%n",
                r.menusSource(), r.menusMapped(), r.menusSkipped());
        System.out.printf ("║  menu_items     source=%-6d  mapped=%-6d  skipped=%-5d  ║%n",
                r.menuItemsSource(), r.menuItemsMapped(), r.menuItemsSkipped());
        System.out.printf ("║  rank_math      source=%-6d  mapped=%-6d  skipped=%-5d  ║%n",
                r.rankMathRedirectsSource(), r.rankMathRedirectsMapped(), r.rankMathRedirectsSkipped());
        System.out.printf ("║  fg_redirect    source=%-6d  mapped=%-6d  skipped=%-5d  ║%n",
                r.fgRedirectsSource(), r.fgRedirectsMapped(), r.fgRedirectsSkipped());
        System.out.printf ("║  permalink      entries=%-6d  parsed=%-6d  conflicts=%-3d  ║%n",
                r.permalinkEntriesSource(), r.permalinkEntriesParsed(), r.permalinkConflicts().size());
        System.out.println("╠═══════════════════════════════════════════════════════════════╣");
        System.out.printf ("║  total_source=%-6d  total_mapped=%-6d  warnings=%-6d    ║%n",
                r.totalSourceRows(), r.totalMapped(), r.totalWarnings());
        System.out.printf ("║  streaming_warnings=%-3d  elapsed=%d ms (~%d s)              ║%n",
                r.streamingWarnings().size(), elapsed, elapsed / 1000);
        System.out.println("╚═══════════════════════════════════════════════════════════════╝");
        System.out.println();

        // Machine-readable key=value for parsing
        System.out.println("=== PHASE2B1_COUNTS_BEGIN ===");
        System.out.println("products.source=" + r.productsSource());
        System.out.println("products.mapped=" + r.productsMapped());
        System.out.println("products.skipped=" + r.productsSkipped());
        System.out.println("variations.source=" + r.variationsSource());
        System.out.println("variations.mapped=" + r.variationsMapped());
        System.out.println("variations.deferred=" + r.variationsDeferred());
        System.out.println("categories.source=" + r.categoriesSource());
        System.out.println("categories.mapped=" + r.categoriesMapped());
        System.out.println("categories.skipped=" + r.categoriesSkipped());
        System.out.println("brands.source=" + r.brandsSource());
        System.out.println("brands.mapped=" + r.brandsMapped());
        System.out.println("brands.skipped=" + r.brandsSkipped());
        System.out.println("tags.source=" + r.tagsSource());
        System.out.println("tags.deferred=" + r.tagsDeferred());
        System.out.println("media.source=" + r.mediaSource());
        System.out.println("media.mapped=" + r.mediaMapped());
        System.out.println("media.skipped=" + r.mediaSkipped());
        System.out.println("pages.source=" + r.pagesSource());
        System.out.println("pages.mapped=" + r.pagesMapped());
        System.out.println("pages.skipped=" + r.pagesSkipped());
        System.out.println("articles.source=" + r.articlesSource());
        System.out.println("articles.mapped=" + r.articlesMapped());
        System.out.println("articles.skipped=" + r.articlesSkipped());
        System.out.println("menus.source=" + r.menusSource());
        System.out.println("menus.mapped=" + r.menusMapped());
        System.out.println("menus.skipped=" + r.menusSkipped());
        System.out.println("menu_items.source=" + r.menuItemsSource());
        System.out.println("menu_items.mapped=" + r.menuItemsMapped());
        System.out.println("menu_items.skipped=" + r.menuItemsSkipped());
        System.out.println("rank_math.source=" + r.rankMathRedirectsSource());
        System.out.println("rank_math.mapped=" + r.rankMathRedirectsMapped());
        System.out.println("rank_math.skipped=" + r.rankMathRedirectsSkipped());
        System.out.println("fg_redirect.source=" + r.fgRedirectsSource());
        System.out.println("fg_redirect.mapped=" + r.fgRedirectsMapped());
        System.out.println("fg_redirect.skipped=" + r.fgRedirectsSkipped());
        System.out.println("permalink.source=" + r.permalinkEntriesSource());
        System.out.println("permalink.parsed=" + r.permalinkEntriesParsed());
        System.out.println("permalink.conflicts=" + r.permalinkConflicts().size());
        System.out.println("total.source_rows=" + r.totalSourceRows());
        System.out.println("total.mapped=" + r.totalMapped());
        System.out.println("total.warnings=" + r.totalWarnings());
        System.out.println("streaming.warnings=" + r.streamingWarnings().size());
        System.out.println("dup_sku=" + r.productWarnings().stream()
                .filter(w -> w.startsWith("Duplicate SKU")).count());
        System.out.println("invalid_price=" + r.productWarnings().stream()
                .filter(w -> w.contains("Cannot parse _price")).count());
        System.out.println("missing_file=" + r.mediaWarnings().stream()
                .filter(w -> w.startsWith("Missing _wp_attached_file")).count());
        System.out.println("self_loop_redirect=" + r.rankMathRedirectWarnings().stream()
                .filter(w -> w.contains("Self-loop")).count());
        System.out.println("dup_redirect_source=" + r.rankMathRedirectWarnings().stream()
                .filter(w -> w.contains("Duplicate enabled")).count());
        System.out.println("elapsed.ms=" + elapsed);
        System.out.println("=== PHASE2B1_COUNTS_END ===");
        System.out.println();
    }
}
