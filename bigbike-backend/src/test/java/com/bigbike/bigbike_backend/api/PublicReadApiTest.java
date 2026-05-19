package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class PublicReadApiTest {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ProductJpaRepository productRepo;

    @Autowired
    private CategoryJpaRepository categoryRepo;

    @Autowired
    private BrandJpaRepository brandRepo;

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    // ── PRODINV-001 replacement: self-seeding public catalog tests ────────────────

    @Test
    void publicProductList_pagination_returnsMeta() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity cat = seedCategory("pub-cat-pg-" + suffix, "Pub Cat PG " + suffix);
        seedProduct("pub-pg-p1-" + suffix, "Pub Pg Product 1 " + suffix, cat, PublishStatus.PUBLISHED, 1_000_000L);
        seedProduct("pub-pg-p2-" + suffix, "Pub Pg Product 2 " + suffix, cat, PublishStatus.PUBLISHED, 2_000_000L);
        seedProduct("pub-pg-p3-" + suffix, "Pub Pg Product 3 " + suffix, cat, PublishStatus.PUBLISHED, 3_000_000L);

        mockMvc.perform(get("/api/v1/products")
                        .param("page", "1").param("size", "2")
                        .param("category", "pub-cat-pg-" + suffix))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.pagination.page").value(1))
                .andExpect(jsonPath("$.pagination.pageSize").value(2))
                .andExpect(jsonPath("$.pagination.totalItems").value(3))
                .andExpect(jsonPath("$.pagination.totalPages").value(2))
                .andExpect(jsonPath("$.meta.requestId").exists())
                .andExpect(jsonPath("$.meta.timestamp").exists());
    }

    @Test
    void publicProductList_excludesNonPublished() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity cat = seedCategory("pub-cat-vis-" + suffix, "Pub Cat Vis " + suffix);
        seedProduct("pub-vis-pub-" + suffix, "Pub Visible Published " + suffix, cat, PublishStatus.PUBLISHED, 1_500_000L);
        seedProduct("pub-vis-dft-" + suffix, "Pub Visible Draft " + suffix, cat, PublishStatus.DRAFT, 1_500_000L);

        mockMvc.perform(get("/api/v1/products")
                        .param("category", "pub-cat-vis-" + suffix))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].slug").value("pub-vis-pub-" + suffix));
    }

    @Test
    void publicCategoryDetail_bySlug_returnsVisibleCategory() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity cat = seedCategory("pub-cat-det-" + suffix, "Pub Cat Det " + suffix);

        mockMvc.perform(get("/api/v1/categories/" + cat.getSlug()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value(cat.getSlug()));
    }

    @Test
    void publicBrandDetail_bySlug_returnsVisibleBrand() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        BrandEntity brand = seedBrand("pub-brand-det-" + suffix, "Pub Brand Det " + suffix);

        mockMvc.perform(get("/api/v1/brands/" + brand.getSlug()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value(brand.getSlug()));
    }

    @Test
    void publicCategoryList_excludesHiddenCategories() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String hiddenSlug = "pub-cat-hid-" + suffix;
        CategoryEntity hidden = seedCategory(hiddenSlug, "Pub Cat Hid " + suffix);
        hidden.setVisible(false);
        categoryRepo.save(hidden);

        // Fetch up to 100 categories — hidden slug must never appear
        mockMvc.perform(get("/api/v1/categories").param("size", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.slug == '" + hiddenSlug + "')]").doesNotExist());

        // Verify it is really in DB (hidden) so this is not a false negative
        assertThat(categoryRepo.findBySlug(hiddenSlug)).isPresent();
    }

    @Test
    void publicProductSnapshot_publishedProduct_returnsSnapshot() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity cat = seedCategory("pub-snap-cat-" + suffix, "Pub Snap Cat " + suffix);
        String slug = "pub-snap-prod-" + suffix;
        seedProduct(slug, "Pub Snap Product " + suffix, cat, PublishStatus.PUBLISHED, 2_500_000L);

        mockMvc.perform(get("/api/v1/products/" + slug + "/snapshot"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pricing.retailPrice").value(2500000))
                .andExpect(jsonPath("$.data.stock.stockState").isString());
    }

    @Test
    void publicProductSnapshot_nonPublishedProduct_returns404() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity cat = seedCategory("pub-snap-cat2-" + suffix, "Pub Snap Cat2 " + suffix);
        String slug = "pub-snap-draft-" + suffix;
        seedProduct(slug, "Pub Snap Draft " + suffix, cat, PublishStatus.DRAFT, 1_000_000L);

        mockMvc.perform(get("/api/v1/products/" + slug + "/snapshot"))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldValidateInvalidLegacyPriceRange() throws Exception {
        mockMvc.perform(get("/api/v1/products")
                        .param("min_price", "5000000")
                        .param("max_price", "1000000"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("min_price"))
                .andExpect(jsonPath("$.error.details[0].code").value("INVALID_RANGE"));
    }

    @Test
    void shouldValidateUnsupportedSort() throws Exception {
        mockMvc.perform(get("/api/v1/products")
                        .param("sort", "unknown:desc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("sort"))
                .andExpect(jsonPath("$.error.details[0].code").value("UNSUPPORTED_SORT_FIELD"))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void shouldReturnNotFoundForUnknownProductSlug() throws Exception {
        mockMvc.perform(get("/api/v1/products/not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.error.message").value("Product not found."));
    }

    @Test
    @Disabled("Requires V1000 catalog seed (disabled) — data not available in H2 test context")
    void shouldReturnCategoryAndBrandDetailBySlug() throws Exception {
        mockMvc.perform(get("/api/v1/categories/mu-bao-hiem"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value("mu-bao-hiem"));

        mockMvc.perform(get("/api/v1/brands/ls2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value("ls2"));
    }

    // ── Catalog facets ──────────────────────────────────────────────────────────

    @Test
    void catalogFacets_returnsAllFacetGroups_andCategoryCountExcludesDraft() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String catSlug = "facet-cat-" + suffix;
        CategoryEntity cat = seedCategory(catSlug, "Facet Cat " + suffix);
        seedProduct("facet-p1-" + suffix, "Facet Product 1 " + suffix, cat, PublishStatus.PUBLISHED, 800_000L);
        seedProduct("facet-p2-" + suffix, "Facet Product 2 " + suffix, cat, PublishStatus.PUBLISHED, 1_500_000L);
        seedProduct("facet-p3-" + suffix, "Facet Product 3 " + suffix, cat, PublishStatus.DRAFT, 2_500_000L);

        mockMvc.perform(get("/api/v1/catalog/facets").param("category", catSlug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.categories").isArray())
                .andExpect(jsonPath("$.data.brands").isArray())
                .andExpect(jsonPath("$.data.colors").isArray())
                .andExpect(jsonPath("$.data.priceBands").isArray())
                // 10 fixed named colors, 9 fixed price bands
                .andExpect(jsonPath("$.data.colors.length()").value(10))
                .andExpect(jsonPath("$.data.priceBands.length()").value(9))
                // category bucket counts only the 2 published products (draft excluded)
                .andExpect(jsonPath("$.data.categories[?(@.key == '" + catSlug + "')].count").value(2));
    }

    @Test
    void catalogFacets_priceBands_countByBand() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String catSlug = "facet-price-cat-" + suffix;
        CategoryEntity cat = seedCategory(catSlug, "Facet Price Cat " + suffix);
        seedProduct("facet-pr1-" + suffix, "Facet Price 1 " + suffix, cat, PublishStatus.PUBLISHED, 500_000L);
        seedProduct("facet-pr2-" + suffix, "Facet Price 2 " + suffix, cat, PublishStatus.PUBLISHED, 1_500_000L);
        seedProduct("facet-pr3-" + suffix, "Facet Price 3 " + suffix, cat, PublishStatus.PUBLISHED, 9_500_000L);

        mockMvc.perform(get("/api/v1/catalog/facets").param("category", catSlug))
                .andExpect(status().isOk())
                // index 0 = 0-1tr, index 1 = 1-2tr, index 8 = tren-9tr (fixed order)
                .andExpect(jsonPath("$.data.priceBands[0].key").value("0-1tr"))
                .andExpect(jsonPath("$.data.priceBands[0].count").value(1))
                .andExpect(jsonPath("$.data.priceBands[1].count").value(1))
                .andExpect(jsonPath("$.data.priceBands[8].key").value("tren-9tr"))
                .andExpect(jsonPath("$.data.priceBands[8].count").value(1));
    }

    @Test
    void catalogFacets_invalidCategorySlug_returns400() throws Exception {
        mockMvc.perform(get("/api/v1/catalog/facets").param("category", "Invalid Slug"))
                .andExpect(status().isBadRequest());
    }

    // ── Seed helpers ─────────────────────────────────────────────────────────────

    private CategoryEntity seedCategory(String slug, String name) {
        return categoryRepo.findBySlug(slug).orElseGet(() -> {
            CategoryEntity cat = new CategoryEntity();
            cat.setId("pub-cat-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10));
            cat.setSlug(slug);
            cat.setName(name);
            cat.setVisible(true);
            Instant now = Instant.now();
            cat.setCreatedAt(now);
            cat.setUpdatedAt(now);
            return categoryRepo.save(cat);
        });
    }

    private void seedProduct(String slug, String name, CategoryEntity cat,
                             PublishStatus status, long retailPriceLong) {
        if (productRepo.findBySlug(slug).isPresent()) return;
        ProductEntity p = new ProductEntity();
        p.setId(UUID.randomUUID().toString());
        p.setSlug(slug);
        p.setName(name);
        p.setRetailPrice(BigDecimal.valueOf(retailPriceLong));
        p.setCurrency("VND");
        p.setPublishStatus(status);
        p.setStockState(ProductStockState.IN_STOCK);
        p.setCategory(cat);
        Instant now = Instant.now();
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        productRepo.save(p);
    }

    private BrandEntity seedBrand(String slug, String name) {
        return brandRepo.findBySlug(slug).orElseGet(() -> {
            BrandEntity b = new BrandEntity();
            b.setId("pub-brand-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
            b.setSlug(slug);
            b.setName(name);
            b.setVisible(true);
            Instant now = Instant.now();
            b.setCreatedAt(now);
            b.setUpdatedAt(now);
            return brandRepo.save(b);
        });
    }

    // ── FULL-08: snapshot accepts internal product-id (prod_xxx) not just slugs ──

    @Test
    void publicProductSnapshot_byProductId_returns200() throws Exception {
        // Create a product whose ID uses the prod_prefix_uuid format (contains underscore).
        // AdminCatalogMutationService.generateId("prod") produces exactly this format.
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String productId = "prod_test_" + suffix;   // underscore — rejected by old SLUG_REGEX
        String slug      = "prod-test-id-" + suffix;

        CategoryEntity cat = seedCategory("pub-snap-id-cat-" + suffix, "Pub Snap ID Cat " + suffix);
        ProductEntity p = new ProductEntity();
        p.setId(productId);
        p.setSlug(slug);
        p.setName("Pub Snap ID Product " + suffix);
        p.setRetailPrice(BigDecimal.valueOf(3_000_000L));
        p.setCurrency("VND");
        p.setPublishStatus(PublishStatus.PUBLISHED);
        p.setStockState(ProductStockState.IN_STOCK);
        p.setCategory(cat);
        Instant now = Instant.now();
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        productRepo.save(p);

        // Must return 200 — previously would return 400 (Pattern rejected underscore)
        mockMvc.perform(get("/api/v1/products/" + productId + "/snapshot"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pricing.retailPrice").value(3000000))
                .andExpect(jsonPath("$.data.stock.stockState").isString());
    }

    @Test
    void publicProductSnapshot_byProductId_unknownId_returns404() throws Exception {
        // Unknown ID in prod_xxx format — should 404, not 400.
        mockMvc.perform(get("/api/v1/products/prod_unknown_id_xyz/snapshot"))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldReturnArticleAndPageBySlug() throws Exception {
        mockMvc.perform(get("/api/v1/articles/chon-mu-fullface-phu-hop"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value("chon-mu-fullface-phu-hop"))
                .andExpect(jsonPath("$.meta.requestId").exists());

        mockMvc.perform(get("/api/v1/pages/chinh-sach-bao-hanh"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value("chinh-sach-bao-hanh"))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    // ── Product list-view projection — list omits detail-only payload ─────────────
    // Guards the "Cắt mạnh" list response: GET /api/v1/products must drop
    // description/gallery/specifications and variant internals (options/gallery),
    // while keeping the variant *count* the storefront card relies on.

    @Test
    void publicProductList_omitsDetailOnlyFields_butKeepsVariantCount() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity cat = seedCategory("pub-lv-cat-" + suffix, "Pub LV Cat " + suffix);
        String slug = "pub-lv-prod-" + suffix;
        seedProductWithDetailAndVariant(slug, "Pub LV Product " + suffix, cat);

        // Detail endpoint still returns the full payload.
        mockMvc.perform(get("/api/v1/products/" + slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.description").value("Detail-only long description"))
                .andExpect(jsonPath("$.data.specifications.length()").value(1))
                .andExpect(jsonPath("$.data.variants.length()").value(1));

        // List endpoint: detail-only fields stripped, variant count preserved.
        String node = "$.data[?(@.slug == '" + slug + "')]";
        mockMvc.perform(get("/api/v1/products")
                        .param("category", "pub-lv-cat-" + suffix))
                .andExpect(status().isOk())
                .andExpect(jsonPath(node + ".slug").value(slug))
                // price is kept on the list view (covered numerically elsewhere)
                .andExpect(jsonPath(node + ".price.retailPrice").exists())
                // detail-only payload must be absent / empty on the list
                .andExpect(jsonPath(node + ".description").value((Object) null))
                .andExpect(jsonPath(node + ".gallery.length()").value(0))
                .andExpect(jsonPath(node + ".specifications.length()").value(0))
                .andExpect(jsonPath(node + ".seo").value((Object) null))
                // variant kept as a stub: count is correct, internals stripped
                .andExpect(jsonPath(node + ".variants.length()").value(1))
                .andExpect(jsonPath(node + ".variants[0].options.length()").value(0))
                .andExpect(jsonPath(node + ".variants[0].gallery.length()").value(0));
    }

    /** Seeds a PUBLISHED product carrying a long description, one spec row and one variant. */
    private void seedProductWithDetailAndVariant(String slug, String name, CategoryEntity cat) {
        if (productRepo.findBySlug(slug).isPresent()) return;
        ProductEntity p = new ProductEntity();
        p.setId(UUID.randomUUID().toString());
        p.setSlug(slug);
        p.setName(name);
        p.setRetailPrice(BigDecimal.valueOf(2_000_000L));
        p.setCurrency("VND");
        p.setPublishStatus(PublishStatus.PUBLISHED);
        p.setStockState(ProductStockState.IN_STOCK);
        p.setCategory(cat);
        p.setShortDescription("Short card subtitle");
        p.setDescription("Detail-only long description");

        com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSpecificationEntity spec =
                new com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSpecificationEntity();
        // id is @GeneratedValue(IDENTITY) — must not be set manually.
        spec.setProduct(p);
        spec.setName("Chất liệu");
        spec.setValue("Sợi carbon");
        spec.setSortOrder(0);
        p.setSpecifications(new java.util.ArrayList<>(java.util.List.of(spec)));

        com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity variant =
                new com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity();
        variant.setId(UUID.randomUUID().toString());
        variant.setProduct(p);
        variant.setSku(slug + "-v1");
        variant.setName("Size M");
        variant.setRetailPrice(BigDecimal.valueOf(2_000_000L));
        variant.setCurrency("VND");
        variant.setStockState(ProductStockState.IN_STOCK);
        variant.setQuantityOnHand(5);
        variant.setSortOrder(0);
        p.setVariants(new java.util.ArrayList<>(java.util.List.of(variant)));

        Instant now = Instant.now();
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        productRepo.save(p);
    }
}
