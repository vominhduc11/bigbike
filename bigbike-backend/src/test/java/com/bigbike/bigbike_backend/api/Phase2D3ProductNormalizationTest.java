package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.migration.wordpress.importer.MigrationExecutionOptions;
import com.bigbike.bigbike_backend.migration.wordpress.importer.MigrationExecutionReport;
import com.bigbike.bigbike_backend.migration.wordpress.importer.ProductImporter;
import com.bigbike.bigbike_backend.migration.wordpress.importer.ProductImporter.ResolvedProduct;
import com.bigbike.bigbike_backend.migration.wordpress.importer.ProductVariationImporter;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressProductMapper.MappedProduct;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressVariationMapper.MappedVariation;
import com.bigbike.bigbike_backend.migration.wordpress.normalizer.ProductCategoryResolver;
import com.bigbike.bigbike_backend.migration.wordpress.normalizer.ProductNormalizationService;
import com.bigbike.bigbike_backend.migration.wordpress.normalizer.ProductNormalizationService.NormalizationResult;
import com.bigbike.bigbike_backend.migration.wordpress.normalizer.ProductSlugGenerator;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
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
 * Phase 2D.3 — Product Normalization tests.
 *
 * Covers slug generation, category recovery, idempotency, and variation linkage.
 * Uses H2 in-memory DB (Spring test profile). Each test is transactional and rolled back.
 */
@SpringBootTest
@Transactional
class Phase2D3ProductNormalizationTest {

    private static final String MEDIA_PUBLIC_BASE_URL = "http://localhost:9000/bigbike-media";

    @Autowired ProductNormalizationService normalizationService;
    @Autowired ProductSlugGenerator slugGenerator;
    @Autowired ProductCategoryResolver categoryResolver;
    @Autowired ProductImporter productImporter;
    @Autowired ProductVariationImporter variationImporter;
    @Autowired ProductJpaRepository productRepo;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired ProductVariantJpaRepository variantRepo;

    private CategoryEntity testCategory;

    @BeforeEach
    void setup() {
        testCategory = categoryRepo.findBySlug("test-norm-cat").orElseGet(() -> {
            CategoryEntity c = new CategoryEntity();
            c.setId("test-norm-cat");
            c.setSlug("test-norm-cat");
            c.setName("Test Norm Category");
            c.setVisible(true);
            c.setCreatedAt(Instant.now());
            c.setUpdatedAt(Instant.now());
            return categoryRepo.save(c);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Slug generation from name
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void product_without_slug_generates_slug_from_name() {
        ResolvedProduct rp = resolvedProduct(80001L, "", "Xe Máy Honda Wave", "test-norm-cat");
        NormalizationResult result = normalizationService.normalize(List.of(rp));

        assertThat(result.products()).hasSize(1);
        String slug = result.products().get(0).product().slug();
        assertThat(slug).isNotBlank();
        assertThat(slug).doesNotContain(" ");
        assertThat(slug).isEqualTo(slug.toLowerCase());
        assertThat(result.recoveredSlugCount()).isEqualTo(1);
    }

    @Test
    void product_slug_generator_strips_vietnamese_diacritics() {
        String slug = ProductSlugGenerator.toSlug("Xe máy Honda");
        assertThat(slug).isEqualTo("xe-may-honda");
    }

    @Test
    void product_slug_generator_strips_d_with_stroke() {
        String slug = ProductSlugGenerator.toSlug("Đường phố");
        assertThat(slug).isEqualTo("duong-pho");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Fallback to legacyId when name produces empty slug
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void product_without_slug_fallback_to_legacyId() {
        // Name contains only non-latin chars that strip to nothing
        String slug = slugGenerator.generate("", 88888L);
        assertThat(slug).isEqualTo("product-88888");
    }

    @Test
    void product_slug_null_name_falls_back_to_legacyId() {
        String slug = slugGenerator.generate(null, 77777L);
        assertThat(slug).isEqualTo("product-77777");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Slug collision — append legacyId
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void product_slug_collision_with_db_appends_legacyId() {
        // Pre-insert a product with the slug that would be generated
        String conflictSlug = "xe-may-honda";
        insertProductWithSlug("wp-prod-98001", conflictSlug);

        ResolvedProduct rp = resolvedProduct(98002L, "", "Xe Máy Honda", "test-norm-cat");
        NormalizationResult result = normalizationService.normalize(List.of(rp));

        String slug = result.products().get(0).product().slug();
        assertThat(slug).isEqualTo("xe-may-honda-98002");
    }

    @Test
    void product_slug_collision_within_batch_appends_legacyId() {
        // Two products in the same batch produce the same candidate slug
        ResolvedProduct rp1 = resolvedProduct(98101L, "", "Honda Wave", "test-norm-cat");
        ResolvedProduct rp2 = resolvedProduct(98102L, "", "Honda Wave", "test-norm-cat");

        NormalizationResult result = normalizationService.normalize(List.of(rp1, rp2));

        String slug1 = result.products().get(0).product().slug();
        String slug2 = result.products().get(1).product().slug();
        assertThat(slug1).isNotEqualTo(slug2);
        assertThat(Set.of(slug1, slug2)).hasSize(2);
    }

    @Test
    void no_duplicate_slug_created() {
        ResolvedProduct rp1 = resolvedProduct(98201L, "", "Yamaha Sirius", "test-norm-cat");
        ResolvedProduct rp2 = resolvedProduct(98202L, "", "Yamaha Sirius", "test-norm-cat");
        ResolvedProduct rp3 = resolvedProduct(98203L, "yamaha-sirius", "Yamaha Sirius", "test-norm-cat");

        NormalizationResult result = normalizationService.normalize(List.of(rp1, rp2, rp3));

        List<String> slugs = result.products().stream()
                .map(r -> r.product().slug()).toList();
        assertThat(slugs).doesNotHaveDuplicates();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Category recovery
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void product_without_category_assigned_uncategorized() {
        ResolvedProduct rp = resolvedProduct(80401L, "some-slug", "Some Product", null);
        NormalizationResult result = normalizationService.normalize(List.of(rp));

        assertThat(result.products().get(0).categorySlug()).isEqualTo("uncategorized");
        assertThat(result.recoveredCategoryCount()).isEqualTo(1);
    }

    @Test
    void uncategorized_category_created_if_missing() {
        // Remove uncategorized if it exists so we can test creation
        categoryRepo.findBySlug("uncategorized").ifPresent(c -> categoryRepo.delete(c));

        categoryResolver.ensureUncategorized();

        Optional<CategoryEntity> created = categoryRepo.findBySlug("uncategorized");
        assertThat(created).isPresent();
        assertThat(created.get().getName()).isEqualTo("Uncategorized");
        assertThat(created.get().isVisible()).isTrue();
    }

    @Test
    void uncategorized_category_not_duplicated_if_already_exists() {
        categoryResolver.ensureUncategorized();
        categoryResolver.ensureUncategorized(); // second call must be idempotent

        long count = categoryRepo.findAll().stream()
                .filter(c -> "uncategorized".equals(c.getSlug())).count();
        assertThat(count).isEqualTo(1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Valid products are not modified
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void normalization_does_not_modify_valid_products() {
        ResolvedProduct rp = resolvedProduct(80501L, "valid-slug", "Valid Product", "test-norm-cat");
        NormalizationResult result = normalizationService.normalize(List.of(rp));

        assertThat(result.products().get(0).product().slug()).isEqualTo("valid-slug");
        assertThat(result.products().get(0).categorySlug()).isEqualTo("test-norm-cat");
        assertThat(result.recoveredSlugCount()).isEqualTo(0);
        assertThat(result.recoveredCategoryCount()).isEqualTo(0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Recovered products are imported successfully
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void recovered_products_imported_successfully() {
        // Product with blank slug and no category
        ResolvedProduct rp = resolvedProduct(80601L, "", "Suzuki Raider", null);
        NormalizationResult norm = normalizationService.normalize(List.of(rp));

        MigrationExecutionOptions opts = importOpts();
        MigrationExecutionReport.DomainResult result =
                productImporter.importBatch(norm.products(), opts, Map.of(), MEDIA_PUBLIC_BASE_URL);

        assertThat(result.inserted()).isEqualTo(1);
        assertThat(result.skipped()).isEqualTo(0);
        assertThat(result.failed()).isEqualTo(0);

        Optional<ProductEntity> saved = productRepo.findBySlug("suzuki-raider");
        assertThat(saved).isPresent();
        assertThat(saved.get().getId()).isEqualTo("wp-prod-80601");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Idempotency preserved after normalization
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void idempotency_preserved_after_normalization() {
        ResolvedProduct rp = resolvedProduct(80701L, "", "Piaggio Liberty", null);

        NormalizationResult norm1 = normalizationService.normalize(List.of(rp));
        productImporter.importBatch(norm1.products(), importOpts(), Map.of(), MEDIA_PUBLIC_BASE_URL);
        long countAfterFirst = productRepo.count();

        NormalizationResult norm2 = normalizationService.normalize(List.of(rp));
        MigrationExecutionReport.DomainResult run2 =
                productImporter.importBatch(norm2.products(), importOpts(), Map.of(), MEDIA_PUBLIC_BASE_URL);
        long countAfterSecond = productRepo.count();

        assertThat(run2.inserted()).isEqualTo(0);
        assertThat(run2.updated()).isEqualTo(1);
        assertThat(countAfterSecond).isEqualTo(countAfterFirst);

        // Same slug generated both times
        assertThat(norm1.products().get(0).product().slug())
                .isEqualTo(norm2.products().get(0).product().slug());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Variation links to recovered parent product
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void variation_import_now_links_to_recovered_products() {
        // Import a recovered product (blank slug → gets generated slug)
        ResolvedProduct rp = resolvedProduct(80801L, "", "Kymco Agility", null);
        NormalizationResult norm = normalizationService.normalize(List.of(rp));
        productImporter.importBatch(norm.products(), importOpts(), Map.of(), MEDIA_PUBLIC_BASE_URL);

        // Verify parent exists in DB
        assertThat(productRepo.findById("wp-prod-80801")).isPresent();

        // Now import a variation that references this recovered product
        MappedVariation mv = new MappedVariation(
                90801L, 80801L, "VAR-REC-001",
                new BigDecimal("2000000"), null, null,
                1, "instock", Map.of("color", "red"), "ACTIVE", List.of());

        MigrationExecutionReport.DomainResult varResult =
                variationImporter.importBatch(List.of(mv), variantOpts());

        assertThat(varResult.inserted()).isEqualTo(1);
        assertThat(varResult.skipped()).isEqualTo(0);
        assertThat(variantRepo.findById("wp-var-90801")).isPresent();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. No product left with null slug after normalization
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void no_product_left_with_null_slug() {
        List<ResolvedProduct> products = List.of(
                resolvedProduct(80901L, null, "Product A", "test-norm-cat"),
                resolvedProduct(80902L, "", "Product B", "test-norm-cat"),
                resolvedProduct(80903L, "valid-slug-c", "Product C", "test-norm-cat")
        );

        NormalizationResult result = normalizationService.normalize(products);

        assertThat(result.products()).allSatisfy(rp -> {
            assertThat(rp.product().slug()).isNotNull();
            assertThat(rp.product().slug()).isNotBlank();
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. No product left without category after normalization
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void no_product_left_without_category() {
        List<ResolvedProduct> products = List.of(
                resolvedProduct(81001L, "slug-a", "Product A", null),
                resolvedProduct(81002L, "slug-b", "Product B", ""),
                resolvedProduct(81003L, "slug-c", "Product C", "test-norm-cat")
        );

        NormalizationResult result = normalizationService.normalize(products);

        assertThat(result.products()).allSatisfy(rp -> {
            assertThat(rp.categorySlug()).isNotNull();
            assertThat(rp.categorySlug()).isNotBlank();
        });
        assertThat(result.recoveredCategoryCount()).isEqualTo(2);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 11. Full suite still passes (structural smoke test)
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void full_suite_normalization_beans_exist() {
        assertThat(normalizationService).isNotNull();
        assertThat(slugGenerator).isNotNull();
        assertThat(categoryResolver).isNotNull();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private ResolvedProduct resolvedProduct(long sourceId, String slug, String name, String categorySlug) {
        MappedProduct mp = new MappedProduct(
                sourceId, slug, name, "", null,
                new BigDecimal("1000000"), new BigDecimal("1000000"), null,
                10, "instock", null, null,
                null, null, null, null, null, null,
                false, null, new BigDecimal("4.5"),
                null, List.of(), "PUBLISHED",
                null, null,
                List.of(), List.of());
        return new ResolvedProduct(mp, categorySlug, null);
    }

    private MigrationExecutionOptions importOpts() {
        return new MigrationExecutionOptions(
                null, Set.of(MigrationDomain.PRODUCTS), 50, false, false);
    }

    private MigrationExecutionOptions variantOpts() {
        return new MigrationExecutionOptions(
                null, Set.of(MigrationDomain.PRODUCT_VARIATIONS), 50, false, false);
    }

    private void insertProductWithSlug(String id, String slug) {
        ProductEntity p = new ProductEntity();
        p.setId(id);
        p.setSlug(slug);
        p.setName("Existing Product");
        p.setRetailPrice(java.math.BigDecimal.valueOf(500000));
        p.setCurrency("VND");
        p.setStockState(ProductStockState.IN_STOCK);
        p.setPublishStatus(PublishStatus.PUBLISHED);
        p.setCategory(testCategory);
        p.setCreatedAt(Instant.now());
        p.setUpdatedAt(Instant.now());
        productRepo.save(p);
    }
}
