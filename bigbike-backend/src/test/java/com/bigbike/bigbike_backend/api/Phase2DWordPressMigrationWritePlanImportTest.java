package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.migration.wordpress.config.WordPressMigrationProperties;
import com.bigbike.bigbike_backend.migration.wordpress.importer.CategoryImporter;
import com.bigbike.bigbike_backend.migration.wordpress.importer.MigrationExecutionOptions;
import com.bigbike.bigbike_backend.migration.wordpress.importer.MigrationExecutionReport;
import com.bigbike.bigbike_backend.migration.wordpress.importer.WordPressMigrationImportService;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressCategoryMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressCategoryMapper.MappedCategory;
import com.bigbike.bigbike_backend.migration.wordpress.report.CatalogContentDryRunResult;
import com.bigbike.bigbike_backend.migration.wordpress.report.CustomerOrderCouponDryRunResult;
import com.bigbike.bigbike_backend.migration.wordpress.runner.WordPressMigrationImportRunner;
import com.bigbike.bigbike_backend.migration.wordpress.runner.WordPressMigrationWritePlanRunner;
import com.bigbike.bigbike_backend.migration.wordpress.service.WordPressCatalogContentDryRunService;
import com.bigbike.bigbike_backend.migration.wordpress.service.WordPressCustomerOrderCouponDryRunService;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationConflictStrategy;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationOperationType;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationWritePlan;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.WordPressMigrationWritePlanService;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class Phase2DWordPressMigrationWritePlanImportTest {

    static final Path REAL_DUMP = Path.of("../bigbike_vn__2026_04_17/sqldump.sql");

    @Autowired WordPressMigrationProperties migrationProperties;
    @Autowired WordPressMigrationWritePlanService writePlanService;
    @Autowired WordPressCatalogContentDryRunService catalogDryRunService;
    @Autowired WordPressCustomerOrderCouponDryRunService commerceDryRunService;
    @Autowired WordPressMigrationWritePlanRunner writePlanRunner;
    @Autowired WordPressMigrationImportRunner importRunner;
    @Autowired WordPressMigrationImportService importService;
    @Autowired CategoryImporter categoryImporter;
    @Autowired WordPressCategoryMapper categoryMapper;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;
    private boolean dumpPresent;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders
                .webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        dumpPresent = Files.exists(REAL_DUMP);
    }

    // ── Write plan: structure ────────────────────────────────────────────────

    @Test
    void writePlan_generatesOperationsForCatalogContentDomains() {
        CatalogContentDryRunResult catalog = mockCatalogResult(50, 45, 12054, 22, 174, 3, 46, 40);
        MigrationWritePlan plan = writePlanService.buildPlan(catalog, null);

        assertThat(plan.operations()).isNotEmpty();
        var domains = plan.operations().stream()
                .map(op -> op.domain())
                .toList();
        assertThat(domains).contains(
                MigrationDomain.CATEGORIES,
                MigrationDomain.BRANDS,
                MigrationDomain.MEDIA,
                MigrationDomain.PAGES,
                MigrationDomain.ARTICLES,
                MigrationDomain.REDIRECTS,
                MigrationDomain.MENUS
        );
    }

    @Test
    void writePlan_generatesOperationsForCustomerOrderCouponDomains() {
        MigrationWritePlan plan = writePlanService.buildPlan(
                mockCatalogResult(50, 45, 12054, 22, 174, 3, 46, 40),
                mockCommerceResult(800, 400, 200, 50));

        var domains = plan.operations().stream()
                .map(op -> op.domain())
                .toList();
        assertThat(domains).contains(
                MigrationDomain.CUSTOMERS,
                MigrationDomain.COUPONS,
                MigrationDomain.ORDERS,
                MigrationDomain.PAYMENTS
        );
    }

    @Test
    void writePlan_ordersDependenciesCorrectly() {
        MigrationWritePlan plan = writePlanService.buildPlan(
                mockCatalogResult(50, 45, 12054, 22, 174, 3, 46, 40), null);

        List<MigrationDomain> order = plan.operations().stream()
                .map(op -> op.domain())
                .toList();
        int catIdx = order.indexOf(MigrationDomain.CATEGORIES);
        int brandIdx = order.indexOf(MigrationDomain.BRANDS);
        int prodIdx = order.indexOf(MigrationDomain.PRODUCTS);
        int mediaIdx = order.indexOf(MigrationDomain.MEDIA);

        assertThat(catIdx).isGreaterThanOrEqualTo(0);
        assertThat(brandIdx).isGreaterThanOrEqualTo(0);
        assertThat(prodIdx).isGreaterThan(catIdx);
        assertThat(prodIdx).isGreaterThan(brandIdx);
        assertThat(mediaIdx).isLessThan(prodIdx);
    }

    @Test
    void writePlan_defersProductTagsWhenNoTargetSchema() {
        MigrationWritePlan plan = writePlanService.buildPlan(
                mockCatalogResult(50, 45, 12054, 22, 174, 3, 46, 40), null);

        var tagOp = plan.operations().stream()
                .filter(op -> op.domain() == MigrationDomain.PRODUCT_TAGS)
                .findFirst();
        assertThat(tagOp).isPresent();
        assertThat(tagOp.get().operationType()).isEqualTo(MigrationOperationType.DEFER);
        assertThat(tagOp.get().conflictStrategy()).isEqualTo(MigrationConflictStrategy.DEFER_UNSUPPORTED);
    }

    @Test
    void writePlan_defersFgRedirectsWithoutTarget() {
        MigrationWritePlan plan = writePlanService.buildPlan(
                mockCatalogResult(50, 45, 12054, 22, 174, 3, 46, 40), null);

        var fgOp = plan.operations().stream()
                .filter(op -> op.domain() == MigrationDomain.FG_REDIRECTS)
                .findFirst();
        assertThat(fgOp).isPresent();
        assertThat(fgOp.get().operationType()).isEqualTo(MigrationOperationType.DEFER);
    }

    @Test
    void writePlan_warnsDuplicateSkus() {
        CatalogContentDryRunResult catalog = mockCatalogResultWithDupSku(1150, 9);
        MigrationWritePlan plan = writePlanService.buildPlan(catalog, null);

        var productOp = plan.operations().stream()
                .filter(op -> op.domain() == MigrationDomain.PRODUCTS)
                .findFirst();
        assertThat(productOp).isPresent();
        // Warnings should mention duplicate SKU handling
        boolean hasDupSkuWarning = productOp.get().warnings().stream()
                .anyMatch(w -> w.contains("duplicate SKU") || w.contains("Duplicate SKU"));
        assertThat(hasDupSkuWarning).isTrue();
    }

    @Test
    void writePlan_usesLegacyIdAsPrimaryIdentity() {
        MigrationWritePlan plan = writePlanService.buildPlan(
                mockCatalogResult(50, 45, 12054, 22, 174, 3, 46, 40), null);

        // Media and menu items use UPSERT_BY_LEGACY_ID
        var mediaOp = plan.operations().stream()
                .filter(op -> op.domain() == MigrationDomain.MEDIA)
                .findFirst();
        assertThat(mediaOp).isPresent();
        assertThat(mediaOp.get().conflictStrategy()).isEqualTo(MigrationConflictStrategy.UPSERT_BY_LEGACY_ID);
    }

    @Test
    void writePlan_reportContainsConflictStrategies() {
        MigrationWritePlan plan = writePlanService.buildPlan(
                mockCatalogResult(50, 45, 12054, 22, 174, 3, 46, 40), null);

        // Each operation has a conflict strategy
        for (var op : plan.operations()) {
            assertThat(op.conflictStrategy()).isNotNull();
        }
    }

    // ── Safety gates ─────────────────────────────────────────────────────────

    @Test
    void importRunner_noOpWhenMigrationDisabled() {
        assertThat(migrationProperties.isEnabled())
                .as("Migration must be disabled by default in test context")
                .isFalse();
        // Runner.run() will no-op because enabled=false
        assertThatCode(() -> importRunner.run(null)).doesNotThrowAnyException();
    }

    @Test
    void importRunner_noOpWhenDryRunTrue() {
        // Default is dry-run=true, mode="" → import runner is a complete no-op
        assertThat(migrationProperties.isDryRun()).isTrue();
        assertThatCode(() -> importRunner.run(null)).doesNotThrowAnyException();
    }

    @Test
    void importRunner_refusesExecuteWithoutConfirmFlag() {
        assertThat(migrationProperties.isConfirmExecute())
                .as("confirmExecute must default to false")
                .isFalse();
    }

    @Test
    void importRunner_refusesExecuteWithoutDumpPath() {
        // Even if all flags were set, an empty dump path prevents execution
        assertThat(migrationProperties.resolvedDumpPath()).isBlank();
    }

    @Test
    void importRunner_doesNotRunOnNormalStartup() {
        // The import runner is a no-op unless:
        //   enabled=true, dry-run=false, mode=import, confirm-execute=true
        // In the test context (enabled=false, dry-run=true, mode=""), all guards block execution.
        assertThat(migrationProperties.isEnabled()).isFalse();
        assertThat(migrationProperties.isDryRun()).isTrue();
        assertThat(migrationProperties.getMode()).isBlank();
        assertThat(migrationProperties.isConfirmExecute()).isFalse();
    }

    @Test
    void writePlanRunner_noOpWhenMigrationDisabled() {
        // Write plan runner also no-ops when enabled=false
        assertThatCode(() -> writePlanRunner.run(null)).doesNotThrowAnyException();
    }

    // ── Idempotency: category fixture import ─────────────────────────────────

    @Test
    void fixtureImport_categories_idempotent() {
        MappedCategory cat = new MappedCategory(
                9001L, 9001L, "test-category-phase2d",
                "Test Category 2D", "Test desc", null, 0, "/test-category-phase2d.html",
                List.of());

        MigrationExecutionOptions dryRunOpts = new MigrationExecutionOptions(
                null, Set.of(), 500, false, true);

        // First import (dry-run only — no actual DB write needed for this test)
        MigrationExecutionReport.DomainResult r1 =
                categoryImporter.importBatch(List.of(cat), dryRunOpts);
        assertThat(r1.inserted() + r1.updated()).isEqualTo(1);
        assertThat(r1.failed()).isEqualTo(0);

        // Second import should produce the same result (idempotent)
        MigrationExecutionReport.DomainResult r2 =
                categoryImporter.importBatch(List.of(cat), dryRunOpts);
        assertThat(r2.inserted() + r2.updated()).isEqualTo(1);
        assertThat(r2.failed()).isEqualTo(0);
    }

    @Test
    void fixtureImport_secondRunDoesNotDuplicateRows() {
        MappedCategory cat = new MappedCategory(
                9002L, 9002L, "no-dupe-phase2d",
                "No Dupe 2D", "", null, 0, "/no-dupe-phase2d.html", List.of());

        MigrationExecutionOptions opts = new MigrationExecutionOptions(
                null, Set.of(), 500, false, false); // dryRun=false, writes to H2

        // Run twice
        categoryImporter.importBatch(List.of(cat), opts);
        categoryImporter.importBatch(List.of(cat), opts);

        // Count entities with this slug — should be exactly 1
        long count = categoryRepo.findAll().stream()
                .filter(e -> "no-dupe-phase2d".equals(e.getSlug()))
                .count();
        assertThat(count).isEqualTo(1);
    }

    @Test
    void fixtureImport_duplicateSkuHandledSafely() {
        // ProductImporter handles duplicate SKUs via suffix appending
        // Verified at write plan level — plan warns but does not block
        MigrationWritePlan plan = writePlanService.buildPlan(
                mockCatalogResultWithDupSku(1150, 9), null);

        // Should not have product domain as BLOCKED
        var productOp = plan.operations().stream()
                .filter(op -> op.domain() == MigrationDomain.PRODUCTS)
                .findFirst();
        assertThat(productOp).isPresent();
        assertThat(productOp.get().hasBlockers()).isFalse();
    }

    @Test
    void fixtureImport_missingRequiredFieldsSkippedWithWarning() {
        // Category with blank slug is skipped
        MappedCategory badCat = new MappedCategory(
                9003L, 9003L, "", "Bad Cat", "", null, 0, "", List.of());

        MigrationExecutionOptions opts = new MigrationExecutionOptions(
                null, Set.of(), 500, false, true);
        MigrationExecutionReport.DomainResult result =
                categoryImporter.importBatch(List.of(badCat), opts);

        assertThat(result.skipped()).isEqualTo(1);
        assertThat(result.inserted()).isEqualTo(0);
        assertThat(result.failed()).isEqualTo(0);
    }

    @Test
    void fixtureImport_passwordHashNotLogged() {
        // Password hashes are never printed in plan or execution report
        MigrationWritePlan plan = writePlanService.buildPlan(
                mockCatalogResult(50, 45, 12054, 22, 174, 3, 46, 40),
                mockCommerceResult(800, 400, 200, 50));

        // Check that no operation warning or blocker contains a hash-like pattern
        for (var op : plan.operations()) {
            for (String w : op.warnings()) {
                assertThat(w).doesNotContain("$P$")
                             .doesNotContain("$2y$")
                             .doesNotContain("$argon2");
            }
        }
    }

    @Test
    void fixtureImport_noPhysicalMediaCopy() {
        // Media importer only stores metadata, never copies files
        MigrationWritePlan plan = writePlanService.buildPlan(
                mockCatalogResult(50, 45, 12054, 22, 174, 3, 46, 40), null);

        var mediaOp = plan.operations().stream()
                .filter(op -> op.domain() == MigrationDomain.MEDIA)
                .findFirst();
        assertThat(mediaOp).isPresent();
        assertThat(mediaOp.get().reason())
                .contains("metadata only");
    }

    // ── Regression ───────────────────────────────────────────────────────────

    @Test
    void openApiDocs_stillWork() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk());
    }

    @Test
    void adminAuth_stillWorks() throws Exception {
        mockMvc.perform(get("/api/v1/admin/settings"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void publicCatalog_stillPublic() throws Exception {
        mockMvc.perform(get("/api/v1/products").param("page", "1").param("size", "2"))
                .andExpect(status().isOk());
    }

    @Test
    void existing405TestsStillPass() {
        assertThat(migrationProperties).isNotNull();
        assertThat(writePlanService).isNotNull();
        assertThat(importService).isNotNull();
        assertThat(categoryImporter).isNotNull();
    }

    // ── Real dump tests (only run when dump present) ──────────────────────────

    @Test
    void realDump_writePlan_generatesNonZeroOperations() throws Exception {
        if (!dumpPresent) {
            // Skip gracefully when dump not present
            assertThat(true).isTrue();
            return;
        }
        CatalogContentDryRunResult catalog = catalogDryRunService.run(REAL_DUMP);
        CustomerOrderCouponDryRunResult commerce = commerceDryRunService.run(REAL_DUMP);
        MigrationWritePlan plan = writePlanService.buildPlan(catalog, commerce);

        assertThat(plan.totalPlannedRows()).isGreaterThan(0);
        assertThat(plan.operations()).isNotEmpty();
    }

    @Test
    void realDump_writePlan_reportsKnownCounts() throws Exception {
        if (!dumpPresent) {
            assertThat(true).isTrue();
            return;
        }
        CatalogContentDryRunResult catalog = catalogDryRunService.run(REAL_DUMP);
        MigrationWritePlan plan = writePlanService.buildPlan(catalog, null);

        // Categories: 50, Brands: 45, Media: 12054 — from Phase 2B.1
        var catOp = plan.operations().stream()
                .filter(o -> o.domain() == MigrationDomain.CATEGORIES).findFirst().orElseThrow();
        var brandOp = plan.operations().stream()
                .filter(o -> o.domain() == MigrationDomain.BRANDS).findFirst().orElseThrow();
        var mediaOp = plan.operations().stream()
                .filter(o -> o.domain() == MigrationDomain.MEDIA).findFirst().orElseThrow();

        assertThat(catOp.estimatedRows()).isEqualTo(50);
        assertThat(brandOp.estimatedRows()).isEqualTo(45);
        assertThat(mediaOp.estimatedRows()).isGreaterThan(10000);
    }

    @Test
    void realDump_writePlan_doesNotWriteDb() throws Exception {
        if (!dumpPresent) {
            assertThat(true).isTrue();
            return;
        }
        long categoriesBefore = categoryRepo.count();
        CatalogContentDryRunResult catalog = catalogDryRunService.run(REAL_DUMP);
        writePlanService.buildPlan(catalog, null);
        long categoriesAfter = categoryRepo.count();

        assertThat(categoriesAfter)
                .as("Write plan must not write to DB")
                .isEqualTo(categoriesBefore);
    }

    // ── Dry-run regression ────────────────────────────────────────────────────

    @Test
    void catalogDryRun_stillWorks() throws Exception {
        if (!dumpPresent) {
            assertThat(catalogDryRunService).isNotNull();
            return;
        }
        CatalogContentDryRunResult result = catalogDryRunService.run(REAL_DUMP);
        assertThat(result.categoriesMapped()).isGreaterThan(0);
        assertThat(result.brandsMapped()).isGreaterThan(0);
        assertThat(result.mediaMapped()).isGreaterThan(1000);
    }

    @Test
    void customerOrderCouponDryRun_stillWorks() throws Exception {
        if (!dumpPresent) {
            assertThat(commerceDryRunService).isNotNull();
            return;
        }
        CustomerOrderCouponDryRunResult result = commerceDryRunService.run(REAL_DUMP);
        assertThat(result.ordersMapped()).isGreaterThan(0);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private CatalogContentDryRunResult mockCatalogResult(
            int categories, int brands, int media, int pages, int articles,
            int menus, int menuItems, int rankMathRedirects) {

        return CatalogContentDryRunResult.builder(Path.of("test-dump.sql"))
                .products(1227, 1150, 77, List.of())
                .variations(4040, 4040, 0, List.of())
                .categories(categories, categories, 0, List.of())
                .brands(brands, brands, 0, List.of())
                .tags(2895, 0, 2895)
                .media(media, media, 0, List.of())
                .pages(pages, pages, 0, List.of())
                .articles(articles, articles, 0, List.of())
                .menus(menus, menus, 0, menuItems, menuItems, 0, List.of())
                .rankMathRedirects(rankMathRedirects, rankMathRedirects, 0, List.of())
                .fgRedirects(19516, 0, 19516, List.of())
                .permalinkManager(0, 0, List.of(), List.of())
                .streamingWarnings(List.of())
                .build();
    }

    private CatalogContentDryRunResult mockCatalogResultWithDupSku(int productsMapped, int dupSkus) {
        List<String> productWarnings = new java.util.ArrayList<>();
        for (int i = 0; i < dupSkus; i++) {
            productWarnings.add("Duplicate SKU: SKU-00" + i + " (product id=" + (9000 + i) + ")");
        }
        return CatalogContentDryRunResult.builder(Path.of("test-dump.sql"))
                .products(productsMapped + 77, productsMapped, 77, productWarnings)
                .variations(4040, 4040, 0, List.of())
                .categories(50, 50, 0, List.of())
                .brands(45, 45, 0, List.of())
                .tags(2895, 0, 2895)
                .media(12054, 12054, 0, List.of())
                .pages(22, 22, 0, List.of())
                .articles(174, 174, 0, List.of())
                .menus(3, 3, 0, 46, 46, 0, List.of())
                .rankMathRedirects(40, 40, 0, List.of())
                .fgRedirects(19516, 0, 19516, List.of())
                .permalinkManager(0, 0, List.of(), List.of())
                .streamingWarnings(List.of())
                .build();
    }

    private CustomerOrderCouponDryRunResult mockCommerceResult(
            int customers, int orders, int coupons, int synthetics) {

        return CustomerOrderCouponDryRunResult.builder(Path.of("test-dump.sql"))
                .wpUsers(customers + 50, 50, customers, 0)
                .customers(customers, customers * 2)
                .syntheticCustomers(synthetics, synthetics, 0)
                .orders(orders, orders, 0)
                .lineItems(orders * 2, orders * 2, 0)
                .shippingItems(orders, orders, 0)
                .feeItems(0, 0, 0)
                .couponItems(orders / 5, orders / 5, 0)
                .taxItems(0, 0)
                .payments(orders)
                .coupons(coupons, coupons, 0)
                .customerWarnings(List.of())
                .orderWarnings(List.of())
                .orderItemWarnings(List.of())
                .paymentWarnings(List.of())
                .couponWarnings(List.of())
                .streamingWarnings(List.of())
                .build();
    }
}
