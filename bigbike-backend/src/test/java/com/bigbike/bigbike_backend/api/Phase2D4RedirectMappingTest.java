package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.migration.wordpress.importer.MigrationExecutionOptions;
import com.bigbike.bigbike_backend.migration.wordpress.importer.MigrationExecutionReport;
import com.bigbike.bigbike_backend.migration.wordpress.importer.RedirectImporter;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressRedirectMapper.MappedRedirect;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpFgRedirect;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpRedirectRow;
import com.bigbike.bigbike_backend.migration.wordpress.redirect.FgRedirectAnalyzer;
import com.bigbike.bigbike_backend.migration.wordpress.redirect.FgRedirectResolver;
import com.bigbike.bigbike_backend.migration.wordpress.redirect.FgRedirectResolver.ResolutionResult;
import com.bigbike.bigbike_backend.migration.wordpress.redirect.LegacyUrlMapper;
import com.bigbike.bigbike_backend.migration.wordpress.redirect.RankMathRedirectImporter;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectJpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Phase 2D.4 — Redirect Completion Strategy tests.
 *
 * Covers:
 *   - FgRedirectResolver: source pattern normalization, resolution, deferred, self-loop
 *   - RedirectImporter: insert, update (idempotent), dry-run, self-loop skip, 301 default
 *   - RankMathRedirectImporter: happy path, self-loop skip
 *   - LegacyUrlMapper: product/brand/category fallback generation
 *   - No duplicate enabled redirects
 *   - Cross-run idempotency (FG + RankMath)
 */
@SpringBootTest
@Transactional
class Phase2D4RedirectMappingTest {

    @Autowired FgRedirectResolver fgRedirectResolver;
    @Autowired FgRedirectAnalyzer fgRedirectAnalyzer;
    @Autowired RankMathRedirectImporter rankMathImporter;
    @Autowired LegacyUrlMapper legacyMapper;
    @Autowired RedirectImporter redirectImporter;
    @Autowired ProductJpaRepository productRepo;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired BrandJpaRepository brandRepo;
    @Autowired RedirectJpaRepository redirectRepo;

    private static final long LEGACY_ID = 12001L;
    private static final String PRODUCT_SLUG = "xe-may-abc-123";
    private static final String BRAND_SLUG = "honda-test";
    private static final String CATEGORY_SLUG = "test-redir-cat";

    @BeforeEach
    void setup() {
        CategoryEntity cat = categoryRepo.findBySlug(CATEGORY_SLUG).orElseGet(() -> {
            CategoryEntity c = new CategoryEntity();
            c.setId("test-redir-cat");
            c.setSlug(CATEGORY_SLUG);
            c.setName("Test Redir Cat");
            c.setVisible(true);
            c.setCreatedAt(Instant.now());
            c.setUpdatedAt(Instant.now());
            return categoryRepo.save(c);
        });

        productRepo.findById("wp-prod-" + LEGACY_ID).orElseGet(() -> {
            ProductEntity p = new ProductEntity();
            p.setId("wp-prod-" + LEGACY_ID);
            p.setSlug(PRODUCT_SLUG);
            p.setName("Xe May ABC 123");
            p.setSku("SKU-12001");
            p.setRetailPrice(java.math.BigDecimal.valueOf(10000));
            p.setCurrency("VND");
            p.setStockState(ProductStockState.IN_STOCK);
            p.setPublishStatus(PublishStatus.PUBLISHED);
            p.setCategory(cat);
            p.setCreatedAt(Instant.now());
            p.setUpdatedAt(Instant.now());
            return productRepo.save(p);
        });

        brandRepo.findBySlug(BRAND_SLUG).orElseGet(() -> {
            BrandEntity b = new BrandEntity();
            b.setId("brand-redir-test");
            b.setSlug(BRAND_SLUG);
            b.setName("Honda Test");
            b.setVisible(true);
            b.setCreatedAt(Instant.now());
            b.setUpdatedAt(Instant.now());
            return brandRepo.save(b);
        });
    }

    // ── toSourcePattern ───────────────────────────────────────────────────────

    @Test
    void sourcePattern_addsLeadingSlash() {
        assertThat(FgRedirectResolver.toSourcePattern("old-slug.html"))
                .isEqualTo("/old-slug.html");
    }

    @Test
    void sourcePattern_preservesExistingLeadingSlash() {
        assertThat(FgRedirectResolver.toSourcePattern("/already-slash.html"))
                .isEqualTo("/already-slash.html");
    }

    @Test
    void sourcePattern_nullReturnsNull() {
        assertThat(FgRedirectResolver.toSourcePattern(null)).isNull();
    }

    // ── FgRedirectResolver.resolve ────────────────────────────────────────────

    @Test
    void resolve_productFound_buildsCorrectTargetUrl() {
        WpFgRedirect row = new WpFgRedirect("old-product.html", LEGACY_ID, "product", true);
        ResolutionResult result = fgRedirectResolver.resolve(List.of(row));

        assertThat(result.resolved()).hasSize(1);
        MappedRedirect mr = result.resolved().get(0);
        assertThat(mr.sourcePattern()).isEqualTo("/old-product.html");
        assertThat(mr.targetPattern()).isEqualTo("/product/" + PRODUCT_SLUG);
        assertThat(mr.redirectCode()).isEqualTo(301);
        assertThat(mr.enabled()).isTrue();
        assertThat(result.deferredCount()).isZero();
    }

    @Test
    void fg_redirects_deferred_if_unresolved() {
        WpFgRedirect row = new WpFgRedirect("ghost-product.html", 99999L, "product", true);
        ResolutionResult result = fgRedirectResolver.resolve(List.of(row));

        assertThat(result.resolved()).isEmpty();
        assertThat(result.deferredCount()).isEqualTo(1);
    }

    @Test
    void resolve_deactivatedRow_deferred() {
        WpFgRedirect row = new WpFgRedirect("old-product.html", LEGACY_ID, "product", false);
        ResolutionResult result = fgRedirectResolver.resolve(List.of(row));

        assertThat(result.resolved()).isEmpty();
        assertThat(result.deferredCount()).isEqualTo(1);
    }

    @Test
    void no_self_loop_redirect() {
        // source == target after normalization
        String sourceWithoutSlash = "product/" + PRODUCT_SLUG;
        WpFgRedirect fgSelfLoop = new WpFgRedirect(sourceWithoutSlash, LEGACY_ID, "product", true);
        ResolutionResult result = fgRedirectResolver.resolve(List.of(fgSelfLoop));

        assertThat(result.resolved()).isEmpty();
        assertThat(result.selfLoopCount()).isEqualTo(1);

        // Also verify RedirectImporter rejects self-loop MappedRedirects
        MappedRedirect selfLoop = new MappedRedirect(1L, "/loop-me", "/loop-me", 301, true, List.of());
        MigrationExecutionOptions opts = new MigrationExecutionOptions(null, Set.of(), 50, false, false);
        MigrationExecutionReport.DomainResult importResult =
                redirectImporter.importBatch(List.of(selfLoop), opts);

        assertThat(importResult.skipped()).isEqualTo(1);
        assertThat(importResult.inserted()).isZero();
        assertThat(redirectRepo.findBySourcePattern("/loop-me")).isEmpty();
    }

    @Test
    void resolve_mixedRows_correctCounts() {
        List<WpFgRedirect> rows = List.of(
                new WpFgRedirect("old-a.html", LEGACY_ID, "product", true),   // resolved
                new WpFgRedirect("old-b.html", 99998L, "product", true),       // deferred: no product
                new WpFgRedirect("old-c.html", LEGACY_ID, "product", false)    // deferred: not activated
        );
        ResolutionResult result = fgRedirectResolver.resolve(rows);

        assertThat(result.resolved()).hasSize(1);
        assertThat(result.deferredCount()).isEqualTo(2);
    }

    // ── RankMathRedirectImporter ──────────────────────────────────────────────

    @Test
    void rankmath_redirects_imported() {
        WpRedirectRow row = new WpRedirectRow(
                5001L,
                "{\"pattern\":\"\\/old-rankmath-url\",\"comparison\":\"exact\"}",
                "/new-rankmath-target",
                301,
                "active",
                "/old-rankmath-url");

        MigrationExecutionOptions opts = new MigrationExecutionOptions(null, Set.of(), 50, false, false);
        RankMathRedirectImporter.ImportResult result = rankMathImporter.importAll(List.of(row), opts);

        assertThat(result.imported()).isEqualTo(1);
        assertThat(result.blankSkipped()).isZero();
        assertThat(result.selfLoopSkipped()).isZero();

        var saved = redirectRepo.findBySourcePattern("/old-rankmath-url");
        assertThat(saved).isPresent();
        assertThat(saved.get().getTargetUrl()).isEqualTo("/new-rankmath-target");
        assertThat(saved.get().getStatusCode()).isEqualTo(301);
        assertThat(saved.get().isEnabled()).isTrue();
    }

    @Test
    void rankmath_self_loop_skipped() {
        WpRedirectRow selfLoop = new WpRedirectRow(
                5002L, null, "/same-url", 301, "active", "/same-url");

        MigrationExecutionOptions opts = new MigrationExecutionOptions(null, Set.of(), 50, false, false);
        RankMathRedirectImporter.ImportResult result = rankMathImporter.importAll(List.of(selfLoop), opts);

        assertThat(result.selfLoopSkipped()).isEqualTo(1);
        assertThat(result.imported()).isZero();
        assertThat(redirectRepo.findBySourcePattern("/same-url")).isEmpty();
    }

    // ── LegacyUrlMapper ───────────────────────────────────────────────────────

    @Test
    void fallback_redirect_generated_for_products() {
        LegacyUrlMapper.MappingResult result = legacyMapper.generateFallbacks();

        // Product from @BeforeEach: slug = PRODUCT_SLUG
        boolean productRedirectPresent = result.redirects().stream()
                .anyMatch(r -> r.sourcePattern().equals("/" + PRODUCT_SLUG + ".html")
                        && r.targetPattern().equals("/product/" + PRODUCT_SLUG + "/"));
        assertThat(productRedirectPresent).isTrue();
        assertThat(result.productCount()).isGreaterThan(0);
    }

    @Test
    void fallback_redirect_generated_for_brands() {
        LegacyUrlMapper.MappingResult result = legacyMapper.generateFallbacks();

        boolean brandRedirectPresent = result.redirects().stream()
                .anyMatch(r -> r.sourcePattern().equals("/brand/" + BRAND_SLUG)
                        && r.targetPattern().equals("/brands/" + BRAND_SLUG));
        assertThat(brandRedirectPresent).isTrue();
        assertThat(result.brandCount()).isGreaterThan(0);
    }

    @Test
    void fallback_redirects_have_301_status() {
        LegacyUrlMapper.MappingResult result = legacyMapper.generateFallbacks();
        assertThat(result.redirects()).isNotEmpty();
        assertThat(result.redirects()).allSatisfy(r -> assertThat(r.redirectCode()).isEqualTo(301));
    }

    // ── RedirectImporter — 301 default, idempotency, dry-run ─────────────────

    @Test
    void status_code_301_default_enforced() {
        // redirectCode=0 must be stored as 301
        MappedRedirect mr = new MappedRedirect(1L, "/zero-code-test.html", "/new-target", 0, true, List.of());
        MigrationExecutionOptions opts = new MigrationExecutionOptions(null, Set.of(), 50, false, false);

        redirectImporter.importBatch(List.of(mr), opts);

        var saved = redirectRepo.findBySourcePattern("/zero-code-test.html");
        assertThat(saved).isPresent();
        assertThat(saved.get().getStatusCode()).isEqualTo(301);
    }

    @Test
    void no_duplicate_enabled_redirects() {
        MappedRedirect mr = new MappedRedirect(1L, "/dup-check.html", "/product/dup-target", 301, true, List.of());
        MigrationExecutionOptions opts = new MigrationExecutionOptions(null, Set.of(), 50, false, false);

        redirectImporter.importBatch(List.of(mr), opts);
        redirectImporter.importBatch(List.of(mr), opts);

        long count = redirectRepo.findAll().stream()
                .filter(r -> "/dup-check.html".equals(r.getSourcePattern()))
                .count();
        assertThat(count).isEqualTo(1);
    }

    @Test
    void idempotency_preserved() {
        WpFgRedirect fgRow = new WpFgRedirect("idp-fg.html", LEGACY_ID, "product", true);
        WpRedirectRow rkRow = new WpRedirectRow(
                6001L,
                "{\"pattern\":\"\\/idp-rm\"}",
                "/idp-rm-target",
                301,
                "active",
                "/idp-rm");

        MigrationExecutionOptions opts = new MigrationExecutionOptions(null, Set.of(), 50, false, false);

        // Run 1
        List<MappedRedirect> fg1 = fgRedirectResolver.resolve(List.of(fgRow)).resolved();
        redirectImporter.importBatch(fg1, opts);
        rankMathImporter.importAll(List.of(rkRow), opts);
        long countRun1 = redirectRepo.count();

        // Run 2
        List<MappedRedirect> fg2 = fgRedirectResolver.resolve(List.of(fgRow)).resolved();
        MigrationExecutionReport.DomainResult fgRun2 = redirectImporter.importBatch(fg2, opts);
        RankMathRedirectImporter.ImportResult rkRun2 = rankMathImporter.importAll(List.of(rkRow), opts);
        long countRun2 = redirectRepo.count();

        assertThat(fgRun2.inserted()).isZero();
        assertThat(fgRun2.updated()).isEqualTo(1);
        assertThat(rkRun2.domainResult().inserted()).isZero();
        assertThat(rkRun2.domainResult().updated()).isEqualTo(1);
        assertThat(countRun2).isEqualTo(countRun1);
    }

    @Test
    void importBatch_insertsResolvedRedirect() {
        WpFgRedirect row = new WpFgRedirect("import-test.html", LEGACY_ID, "product", true);
        List<MappedRedirect> mapped = fgRedirectResolver.resolve(List.of(row)).resolved();

        MigrationExecutionOptions opts = new MigrationExecutionOptions(null, Set.of(), 50, false, false);
        MigrationExecutionReport.DomainResult result = redirectImporter.importBatch(mapped, opts);

        assertThat(result.inserted()).isEqualTo(1);
        assertThat(result.failed()).isZero();

        var saved = redirectRepo.findBySourcePattern("/import-test.html");
        assertThat(saved).isPresent();
        assertThat(saved.get().getTargetUrl()).isEqualTo("/product/" + PRODUCT_SLUG);
        assertThat(saved.get().getStatusCode()).isEqualTo(301);
        assertThat(saved.get().isEnabled()).isTrue();
    }

    @Test
    void importBatch_idempotent_secondRunUpdates() {
        WpFgRedirect row = new WpFgRedirect("idempotent-redir.html", LEGACY_ID, "product", true);
        List<MappedRedirect> mapped = fgRedirectResolver.resolve(List.of(row)).resolved();
        MigrationExecutionOptions opts = new MigrationExecutionOptions(null, Set.of(), 50, false, false);

        redirectImporter.importBatch(mapped, opts);
        MigrationExecutionReport.DomainResult run2 = redirectImporter.importBatch(mapped, opts);

        assertThat(run2.inserted()).isZero();
        assertThat(run2.updated()).isEqualTo(1);
        assertThat(run2.failed()).isZero();
        assertThat(redirectRepo.findBySourcePattern("/idempotent-redir.html")).isPresent();
    }

    @Test
    void importBatch_dryRun_doesNotPersist() {
        WpFgRedirect row = new WpFgRedirect("dryrun-redir.html", LEGACY_ID, "product", true);
        List<MappedRedirect> mapped = fgRedirectResolver.resolve(List.of(row)).resolved();
        MigrationExecutionOptions opts = new MigrationExecutionOptions(null, Set.of(), 50, false, true);

        MigrationExecutionReport.DomainResult result = redirectImporter.importBatch(mapped, opts);

        assertThat(result.inserted()).isEqualTo(1);
        assertThat(redirectRepo.findBySourcePattern("/dryrun-redir.html")).isEmpty();
    }

    // ── FgRedirectAnalyzer ────────────────────────────────────────────────────

    @Test
    void analyzer_reports_correct_counts() {
        List<WpFgRedirect> rows = List.of(
                new WpFgRedirect("ana-a.html", LEGACY_ID, "product", true),    // resolved
                new WpFgRedirect("ana-b.html", 88888L, "product", true),        // deferred
                new WpFgRedirect("ana-c.html", LEGACY_ID, "product", false)     // deferred (inactive)
        );

        FgRedirectAnalyzer.AnalysisResult result = fgRedirectAnalyzer.analyze(rows);

        assertThat(result.total()).isEqualTo(3);
        assertThat(result.resolved()).isEqualTo(1);
        assertThat(result.deferred()).isEqualTo(2);
        assertThat(result.resolvedRedirects()).hasSize(1);
    }
}
