package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.migration.wordpress.importer.MigrationExecutionOptions;
import com.bigbike.bigbike_backend.migration.wordpress.importer.MigrationExecutionReport;
import com.bigbike.bigbike_backend.migration.wordpress.importer.ProductVariationImporter;
import com.bigbike.bigbike_backend.migration.wordpress.importer.WordPressMigrationImportService;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressVariationMapper.MappedVariation;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.WordPressMigrationWritePlanService;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Phase 2D.2 — Product Variation Importer tests.
 *
 * Uses H2 in-memory DB (Spring test profile). Each test creates its own fixture data.
 * Tests cover: mapping, idempotency, missing parent fallback, service wiring, write-plan alignment.
 */
@SpringBootTest
@Transactional
class Phase2D2ProductVariationImporterTest {

    @Autowired ProductVariationImporter variationImporter;
    @Autowired ProductJpaRepository productRepo;
    @Autowired ProductVariantJpaRepository variantRepo;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired WordPressMigrationImportService importService;

    private ProductEntity parentProduct;

    @BeforeEach
    void setup() {
        // Ensure a category exists for the parent product
        CategoryEntity category = categoryRepo.findBySlug("test-cat-var").orElseGet(() -> {
            CategoryEntity c = new CategoryEntity();
            c.setId("test-cat-var");
            c.setSlug("test-cat-var");
            c.setName("Test Category Var");
            c.setCreatedAt(Instant.now());
            c.setUpdatedAt(Instant.now());
            return categoryRepo.save(c);
        });

        // Parent product with deterministic id matching "wp-prod-{sourceId}"
        parentProduct = productRepo.findById("wp-prod-99001").orElseGet(() -> {
            ProductEntity p = new ProductEntity();
            p.setId("wp-prod-99001");
            p.setSlug("test-product-for-variations");
            p.setName("Test Product For Variations");
            p.setRetailPrice(new BigDecimal("1000000"));
            p.setCurrency("VND");
            p.setStockState(ProductStockState.IN_STOCK);
            p.setPublishStatus(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED);
            p.setCategory(category);
            p.setCreatedAt(Instant.now());
            p.setUpdatedAt(Instant.now());
            return productRepo.save(p);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Mapping: variation is correctly mapped to entity fields
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void variation_mapping_priceAndSkuArePreserved() {
        MappedVariation mv = variation(99101L, 99001L, "SKU-VAR-001",
                new BigDecimal("500000"), new BigDecimal("600000"), null,
                5, "instock", Map.of("color", "black"), "ACTIVE");

        MigrationExecutionOptions opts = opts(false);
        MigrationExecutionReport.DomainResult result = variationImporter.importBatch(List.of(mv), opts);

        assertThat(result.inserted()).isEqualTo(1);
        assertThat(result.failed()).isEqualTo(0);

        Optional<ProductVariantEntity> saved = variantRepo.findById("wp-var-99101");
        assertThat(saved).isPresent();
        assertThat(saved.get().getSku()).isEqualTo("SKU-VAR-001");
        assertThat(saved.get().getRetailPrice()).isEqualByComparingTo(new BigDecimal("500000"));
        assertThat(saved.get().getCompareAtPrice()).isEqualByComparingTo(new BigDecimal("600000"));
        assertThat(saved.get().getCurrency()).isEqualTo("VND");
    }

    @Test
    void variation_mapping_stockStateInStock() {
        MappedVariation mv = variation(99102L, 99001L, null,
                new BigDecimal("200000"), null, null,
                null, "instock", Map.of(), "ACTIVE");

        variationImporter.importBatch(List.of(mv), opts(false));

        ProductVariantEntity saved = variantRepo.findById("wp-var-99102").orElseThrow();
        assertThat(saved.getStockState()).isEqualTo(ProductStockState.IN_STOCK);
        assertThat(saved.isAvailable()).isTrue();
    }

    @Test
    void variation_mapping_stockStateOutOfStock() {
        MappedVariation mv = variation(99103L, 99001L, null,
                new BigDecimal("200000"), null, null,
                0, "outofstock", Map.of(), "ACTIVE");

        variationImporter.importBatch(List.of(mv), opts(false));

        ProductVariantEntity saved = variantRepo.findById("wp-var-99103").orElseThrow();
        assertThat(saved.getStockState()).isEqualTo(ProductStockState.OUT_OF_STOCK);
        assertThat(saved.isAvailable()).isFalse();
    }

    @Test
    void variation_mapping_attributesStoredAsOptions() {
        MappedVariation mv = variation(99104L, 99001L, "SKU-OPT",
                new BigDecimal("300000"), null, null,
                2, "instock", Map.of("color", "red", "size", "L"), "ACTIVE");

        variationImporter.importBatch(List.of(mv), opts(false));

        ProductVariantEntity saved = variantRepo.findById("wp-var-99104").orElseThrow();
        assertThat(saved.getOptions()).isNotNull();
        assertThat(saved.getOptions()).hasSize(2);
        assertThat(saved.getOptions()).anyMatch(o -> "color".equals(o.getOptionName()) && "red".equals(o.getOptionValue()));
        assertThat(saved.getOptions()).anyMatch(o -> "size".equals(o.getOptionName()) && "L".equals(o.getOptionValue()));
    }

    @Test
    void variation_mapping_nameBuiltFromAttributes() {
        MappedVariation mv = variation(99105L, 99001L, null,
                new BigDecimal("100000"), null, null,
                1, "instock", Map.of("color", "blue"), "ACTIVE");

        variationImporter.importBatch(List.of(mv), opts(false));

        ProductVariantEntity saved = variantRepo.findById("wp-var-99105").orElseThrow();
        assertThat(saved.getName()).contains("color").contains("blue");
    }

    @Test
    void variation_mapping_emptyAttributesFallbackName() {
        MappedVariation mv = variation(99106L, 99001L, null,
                new BigDecimal("100000"), null, null,
                null, "instock", Map.of(), "ACTIVE");

        variationImporter.importBatch(List.of(mv), opts(false));

        ProductVariantEntity saved = variantRepo.findById("wp-var-99106").orElseThrow();
        assertThat(saved.getName()).contains("99106");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Idempotency: second run updates, does not duplicate
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void variation_idempotency_firstRunInserts() {
        MappedVariation mv = variation(99201L, 99001L, "IDEM-001",
                new BigDecimal("400000"), null, null,
                3, "instock", Map.of("size", "M"), "ACTIVE");

        MigrationExecutionReport.DomainResult run1 = variationImporter.importBatch(List.of(mv), opts(false));

        assertThat(run1.inserted()).isEqualTo(1);
        assertThat(run1.updated()).isEqualTo(0);
        assertThat(variantRepo.findById("wp-var-99201")).isPresent();
    }

    @Test
    void variation_idempotency_secondRunUpdatesNotDuplicates() {
        MappedVariation mv = variation(99202L, 99001L, "IDEM-002",
                new BigDecimal("500000"), null, null,
                1, "instock", Map.of("size", "XL"), "ACTIVE");

        variationImporter.importBatch(List.of(mv), opts(false));
        long countAfterFirst = variantRepo.count();

        MigrationExecutionReport.DomainResult run2 = variationImporter.importBatch(List.of(mv), opts(false));

        assertThat(run2.inserted()).isEqualTo(0);
        assertThat(run2.updated()).isEqualTo(1);
        assertThat(variantRepo.count()).isEqualTo(countAfterFirst);
    }

    @Test
    void variation_idempotency_optionsReplacedOnUpdate() {
        MappedVariation v1 = variation(99203L, 99001L, "OPT-UPD",
                new BigDecimal("300000"), null, null,
                2, "instock", Map.of("color", "green"), "ACTIVE");
        variationImporter.importBatch(List.of(v1), opts(false));

        MappedVariation v2 = variation(99203L, 99001L, "OPT-UPD",
                new BigDecimal("350000"), null, null,
                2, "instock", Map.of("color", "yellow", "size", "S"), "ACTIVE");
        variationImporter.importBatch(List.of(v2), opts(false));

        ProductVariantEntity saved = variantRepo.findById("wp-var-99203").orElseThrow();
        assertThat(saved.getOptions()).hasSize(2);
        assertThat(saved.getOptions()).anyMatch(o -> "yellow".equals(o.getOptionValue()));
        assertThat(saved.getOptions()).noneMatch(o -> "green".equals(o.getOptionValue()));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Missing parent product: create placeholder parent, no crash
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void variation_missingParent_createsPlaceholderParentAndImportsVariation() {
        MappedVariation mv = variation(99301L, 99999L, "ORPHAN-001",
                new BigDecimal("200000"), null, null,
                1, "instock", Map.of(), "ACTIVE");

        MigrationExecutionReport.DomainResult result = variationImporter.importBatch(List.of(mv), opts(false));

        assertThat(result.skipped()).isEqualTo(0);
        assertThat(result.inserted()).isEqualTo(1);
        assertThat(result.failed()).isEqualTo(0);
        assertThat(result.warnings()).anyMatch(w -> w.contains("Created placeholder parent product"));
        assertThat(variantRepo.findById("wp-var-99301")).isPresent();
        assertThat(productRepo.findById("wp-prod-99999")).isPresent();
    }

    @Test
    void variation_missingParent_doesNotBlockOtherVariations() {
        MappedVariation orphan = variation(99302L, 99999L, null,
                new BigDecimal("100000"), null, null, null, "instock", Map.of(), "ACTIVE");
        MappedVariation valid = variation(99303L, 99001L, "VALID-002",
                new BigDecimal("200000"), null, null, 1, "instock", Map.of("type", "A"), "ACTIVE");

        MigrationExecutionReport.DomainResult result =
                variationImporter.importBatch(List.of(orphan, valid), opts(false));

        assertThat(result.skipped()).isEqualTo(0);
        assertThat(result.inserted()).isEqualTo(2);
        assertThat(productRepo.findById("wp-prod-99999")).isPresent();
        assertThat(variantRepo.findById("wp-var-99302")).isPresent();
        assertThat(variantRepo.findById("wp-var-99303")).isPresent();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Dry-run: no DB writes
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void variation_dryRun_doesNotPersist() {
        MappedVariation mv = variation(99401L, 99001L, "DRY-001",
                new BigDecimal("100000"), null, null, 1, "instock", Map.of(), "ACTIVE");

        variationImporter.importBatch(List.of(mv), opts(true));

        assertThat(variantRepo.findById("wp-var-99401")).isEmpty();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Service wiring: WordPressMigrationImportService calls variation importer
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void service_productVariationsIsInDependencyOrder() {
        List<MigrationDomain> order = WordPressMigrationWritePlanService.DEPENDENCY_ORDER;
        assertThat(order).contains(MigrationDomain.PRODUCT_VARIATIONS);
    }

    @Test
    void service_productVariationsAfterProductsInOrder() {
        List<MigrationDomain> order = WordPressMigrationWritePlanService.DEPENDENCY_ORDER;
        int prodIdx = order.indexOf(MigrationDomain.PRODUCTS);
        int varIdx = order.indexOf(MigrationDomain.PRODUCT_VARIATIONS);
        assertThat(varIdx).isGreaterThan(prodIdx);
    }

    @Test
    void service_variationImporterBeanExists() {
        assertThat(variationImporter).isNotNull();
    }

    @Test
    void service_variationImporterDomainIsProductVariations() {
        assertThat(variationImporter.domain()).isEqualTo(MigrationDomain.PRODUCT_VARIATIONS);
    }

    @Test
    void service_importServiceHasVariationImporterWired() {
        // ProductVariationImporter must be a field of WordPressMigrationImportService
        boolean hasField = java.util.Arrays.stream(
                WordPressMigrationImportService.class.getDeclaredFields())
                .anyMatch(f -> f.getType().equals(ProductVariationImporter.class));
        assertThat(hasField).isTrue();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Duplicate prevention: same sourceId produces same variant id (no duplication)
    // ─────────────────────────────────────────────────────────────────────chers
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void variation_sameSourceId_producesIdempotentId() {
        long sourceId = 99501L;
        String expectedId = "wp-var-" + sourceId;

        MappedVariation mv = variation(sourceId, 99001L, "DUP-001",
                new BigDecimal("100000"), null, null, 1, "instock", Map.of(), "ACTIVE");

        variationImporter.importBatch(List.of(mv), opts(false));
        variationImporter.importBatch(List.of(mv), opts(false));

        assertThat(variantRepo.findById(expectedId)).isPresent();
        long count = variantRepo.findAll().stream()
                .filter(v -> v.getId().equals(expectedId))
                .count();
        assertThat(count).isEqualTo(1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private MappedVariation variation(long sourceId, long parentId, String sku,
            java.math.BigDecimal price, java.math.BigDecimal regularPrice,
            java.math.BigDecimal salePrice, Integer stock, String stockStatus,
            Map<String, String> attributes, String status) {
        return new MappedVariation(sourceId, parentId, sku, price, regularPrice, salePrice,
                stock, stockStatus, attributes, status, List.of(), List.of());
    }

    private MigrationExecutionOptions opts(boolean dryRun) {
        return new MigrationExecutionOptions(
                null, Set.of(MigrationDomain.PRODUCT_VARIATIONS), 50, false, dryRun);
    }
}
