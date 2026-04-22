package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.migration.wordpress.importer.MigrationExecutionOptions;
import com.bigbike.bigbike_backend.migration.wordpress.importer.MigrationExecutionReport;
import com.bigbike.bigbike_backend.migration.wordpress.importer.RedirectImporter;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressRedirectMapper.MappedRedirect;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpFgRedirect;
import com.bigbike.bigbike_backend.migration.wordpress.redirect.FgRedirectResolver;
import com.bigbike.bigbike_backend.migration.wordpress.redirect.FgRedirectResolver.ResolutionResult;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectJpaRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Phase 2D.4 — Redirect Mapping tests.
 *
 * Covers FG redirect resolution: product lookup, target URL derivation,
 * deferred handling, self-loop detection, idempotency, and dry-run.
 */
@SpringBootTest
@Transactional
class Phase2D4RedirectMappingTest {

    @Autowired FgRedirectResolver fgRedirectResolver;
    @Autowired RedirectImporter redirectImporter;
    @Autowired ProductJpaRepository productRepo;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired RedirectJpaRepository redirectRepo;

    private static final long LEGACY_ID = 12001L;
    private static final String PRODUCT_SLUG = "xe-may-abc-123";

    @BeforeEach
    void setup() {
        CategoryEntity cat = categoryRepo.findBySlug("test-redir-cat").orElseGet(() -> {
            CategoryEntity c = new CategoryEntity();
            c.setId("test-redir-cat");
            c.setSlug("test-redir-cat");
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
            p.setPrice(BigDecimal.valueOf(10000));
            p.setRegularPrice(BigDecimal.valueOf(10000));
            p.setStockState(ProductStockState.IN_STOCK);
            p.setStatus(PublishStatus.PUBLISHED);
            p.setCategory(cat);
            p.setCreatedAt(Instant.now());
            p.setUpdatedAt(Instant.now());
            return productRepo.save(p);
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
    void resolve_productNotFound_deferred() {
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
    void resolve_selfLoop_excluded() {
        // Source pattern equals target URL — should be counted as selfLoop, not resolved
        String sourceWithoutSlash = "product/" + PRODUCT_SLUG;
        WpFgRedirect row = new WpFgRedirect(sourceWithoutSlash, LEGACY_ID, "product", true);
        ResolutionResult result = fgRedirectResolver.resolve(List.of(row));

        assertThat(result.resolved()).isEmpty();
        assertThat(result.selfLoopCount()).isEqualTo(1);
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

    // ── RedirectImporter.importBatch ──────────────────────────────────────────

    @Test
    void importBatch_insertsResolvedRedirect() {
        WpFgRedirect row = new WpFgRedirect("import-test.html", LEGACY_ID, "product", true);
        List<MappedRedirect> mapped = fgRedirectResolver.resolve(List.of(row)).resolved();

        MigrationExecutionOptions opts = new MigrationExecutionOptions(null, Set.of(), 50, false, false);
        MigrationExecutionReport.DomainResult result = redirectImporter.importBatch(mapped, opts);

        assertThat(result.inserted()).isEqualTo(1);
        assertThat(result.failed()).isZero();

        Optional<var> saved = redirectRepo.findBySourcePattern("/import-test.html");
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
}
