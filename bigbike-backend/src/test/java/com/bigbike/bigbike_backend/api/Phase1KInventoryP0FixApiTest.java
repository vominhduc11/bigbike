package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class Phase1KInventoryP0FixApiTest {

    private static final String ADMIN_EMAIL = "p0fix-admin-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS  = "Admin@P0Fix12345";
    // CONTRIBUTOR is in AdminRolePermissions.MAP with only content.read + media.read — no inventory.write
    private static final String NOPERM_EMAIL = "p0fix-noperm-" + UUID.randomUUID() + "@bigbike.test";
    private static final String NOPERM_PASS  = "Noperm@P0Fix123";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired ProductJpaRepository productRepo;
    @Autowired ProductVariantJpaRepository variantRepo;
    @Autowired StockMovementJpaRepository movementRepo;
    @Autowired PasswordService passwordService;

    private MockMvc mockMvc;
    private String adminToken;
    private String noPermToken;
    private String testVariantId;
    private String testProductName;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureAdminUser(ADMIN_EMAIL, ADMIN_PASS, "ADMIN");
        ensureAdminUser(NOPERM_EMAIL, NOPERM_PASS, "CONTRIBUTOR");
        adminToken  = loginUser(ADMIN_EMAIL, ADMIN_PASS);
        noPermToken = loginUser(NOPERM_EMAIL, NOPERM_PASS);
        testProductName = "P0Fix Product " + UUID.randomUUID().toString().substring(0, 8);
        testVariantId   = ensureTestVariant(testProductName);
    }

    // ── 1. Manual stock IN succeeds: quantity updated, movement written ───────────

    @Test
    void manualStockIn_updatesQuantityAndWritesMovement() throws Exception {
        ProductVariantEntity before = variantRepo.findById(testVariantId).orElseThrow();
        int qtyBefore = before.getQuantityOnHand();

        String s1 = "SN-P0-IN-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String s2 = "SN-P0-IN-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);

        mockMvc.perform(post("/api/v1/admin/inventory/variants/" + testVariantId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "quantityDelta": 2, "movementType": "IN",
                                  "serialNumbers": ["%s", "%s"] }
                                """.formatted(s1, s2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quantityOnHand").value(qtyBefore + 2));

        ProductVariantEntity after = variantRepo.findById(testVariantId).orElseThrow();
        assertThat(after.getQuantityOnHand()).isEqualTo(qtyBefore + 2);

        long movCount = movementRepo.countByVariantId(testVariantId);
        assertThat(movCount).isGreaterThan(0);
    }

    // ── 2. Manual adjust cannot go below zero ────────────────────────────────────

    @Test
    void manualAdjust_belowZero_returns400() throws Exception {
        ProductVariantEntity v = variantRepo.findById(testVariantId).orElseThrow();
        int current = v.getQuantityOnHand();

        mockMvc.perform(post("/api/v1/admin/inventory/variants/" + testVariantId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "quantityDelta": %d, "movementType": "OUT" }
                                """.formatted(-(current + 100))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].code").value("BELOW_ZERO"));
    }

    // ── 3. Movement response includes productName and variantName ────────────────

    @Test
    void movementList_includesProductAndVariantName() throws Exception {
        String s1 = "SN-P0-NM-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);

        mockMvc.perform(post("/api/v1/admin/inventory/variants/" + testVariantId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "quantityDelta": 1, "movementType": "IN",
                                  "serialNumbers": ["%s"] }
                                """.formatted(s1)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/admin/inventory/variants/" + testVariantId + "/movements")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("page", "1").param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].productName").value(testProductName))
                .andExpect(jsonPath("$.items[0].variantName").isString())
                .andExpect(jsonPath("$.items[0].variantSku").isString());
    }

    // ── 4. Global movements list also includes productName ───────────────────────

    @Test
    void globalMovementList_includesProductName() throws Exception {
        String s1 = "SN-P0-GL-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);

        mockMvc.perform(post("/api/v1/admin/inventory/variants/" + testVariantId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "quantityDelta": 1, "movementType": "IN",
                                  "serialNumbers": ["%s"] }
                                """.formatted(s1)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/admin/inventory/movements")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("page", "1").param("size", "5")
                        .param("movementType", "IN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].productName").isString())
                .andExpect(jsonPath("$.items[0].variantSku").isString());
    }

    // ── 5. CSV export requires authentication ────────────────────────────────────

    @Test
    void csvExport_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/inventory/export.csv"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void csvExport_withValidToken_returnsCsv() throws Exception {
        mockMvc.perform(get("/api/v1/admin/inventory/export.csv")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/csv"));
    }

    // ── 6. Permission denied for inventory adjust without inventory.write ─────────

    @Test
    void adjust_withViewerRole_returns403() throws Exception {
        mockMvc.perform(post("/api/v1/admin/inventory/variants/" + testVariantId + "/adjust")
                        .header("Authorization", "Bearer " + noPermToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "quantityDelta": 1, "movementType": "ADJUSTMENT" }
                                """))
                .andExpect(status().isForbidden());
    }

    // ── 7. Concurrent adjust on same variant — no lost update ────────────────────

    @Test
    void concurrentAdjust_noLostUpdate() throws Exception {
        // Seed enough stock to subtract from
        String s1 = "SN-CONC-BASE-" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        String s2 = "SN-CONC-BASE-" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        String s3 = "SN-CONC-BASE-" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        String s4 = "SN-CONC-BASE-" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        mockMvc.perform(post("/api/v1/admin/inventory/variants/" + testVariantId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "quantityDelta": 4, "movementType": "IN",
                                  "serialNumbers": ["%s","%s","%s","%s"] }
                                """.formatted(s1, s2, s3, s4)))
                .andExpect(status().isOk());

        ProductVariantEntity seeded = variantRepo.findById(testVariantId).orElseThrow();
        int qtyBeforeConcurrent = seeded.getQuantityOnHand();

        // Fire two concurrent OUT adjustments of 1 each
        int threads = 2;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch go    = new CountDownLatch(1);
        List<Future<Integer>> futures = new ArrayList<>();

        for (int i = 0; i < threads; i++) {
            futures.add(pool.submit(() -> {
                ready.countDown();
                go.await();
                MvcResult r = mockMvc.perform(post("/api/v1/admin/inventory/variants/" + testVariantId + "/adjust")
                                .header("Authorization", "Bearer " + adminToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"quantityDelta\": -1, \"movementType\": \"OUT\"}"))
                        .andReturn();
                return r.getResponse().getStatus();
            }));
        }
        ready.await();
        go.countDown();
        pool.shutdown();

        long ok = futures.stream().mapToInt(f -> { try { return f.get(); } catch (Exception e) { return 0; } })
                         .filter(s -> s == 200).count();
        assertThat(ok).isEqualTo(threads); // Both should succeed

        ProductVariantEntity final_ = variantRepo.findById(testVariantId).orElseThrow();
        // Exact deduction: no lost update means qty decreased by exactly threads
        assertThat(final_.getQuantityOnHand()).isEqualTo(qtyBeforeConcurrent - threads);
    }

    // ── 8. ADJUSTMENT movement type accepted ─────────────────────────────────────

    @Test
    void adjustment_movementType_accepted() throws Exception {
        ProductVariantEntity v = variantRepo.findById(testVariantId).orElseThrow();
        int qty = v.getQuantityOnHand();

        mockMvc.perform(post("/api/v1/admin/inventory/variants/" + testVariantId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "quantityDelta": 5, "movementType": "ADJUSTMENT",
                                  "note": "Cycle count correction" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quantityOnHand").value(qty + 5));
    }

    // ── 9. Invalid movementType rejected ─────────────────────────────────────────

    @Test
    void adjust_invalidMovementType_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/admin/inventory/variants/" + testVariantId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "quantityDelta": 1, "movementType": "SALE" }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].code").value("INVALID"));
    }

    // ── 10. Product-level adjust — increases stockQuantity and writes movement ───

    @Test
    void productLevelAdjust_increasesStockAndWritesMovement() throws Exception {
        String productId = ensureTestProduct("ProdLevel Adjust " + UUID.randomUUID().toString().substring(0, 8));

        mockMvc.perform(post("/api/v1/admin/inventory/products/" + productId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "quantityDelta": 10, "movementType": "IN", "note": "Initial stock" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quantityOnHand").value(10))
                .andExpect(jsonPath("$.variantId").doesNotExist());

        ProductEntity updated = productRepo.findById(productId).orElseThrow();
        assertThat(updated.getStockQuantity()).isEqualTo(10);

        long movCount = movementRepo.countByProductId(productId);
        assertThat(movCount).isGreaterThan(0);
    }

    // ── 11. Product-level adjust below zero returns 400 ──────────────────────────

    @Test
    void productLevelAdjust_belowZero_returns400() throws Exception {
        String productId = ensureTestProduct("ProdLevel BelowZero " + UUID.randomUUID().toString().substring(0, 8));

        mockMvc.perform(post("/api/v1/admin/inventory/products/" + productId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "quantityDelta": -999, "movementType": "OUT" }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].code").value("BELOW_ZERO"));
    }

    // ── 12. Product-level adjust requires inventory.write permission ──────────────

    @Test
    void productLevelAdjust_requiresInventoryWritePermission() throws Exception {
        String productId = ensureTestProduct("ProdLevel Perm " + UUID.randomUUID().toString().substring(0, 8));

        mockMvc.perform(post("/api/v1/admin/inventory/products/" + productId + "/adjust")
                        .header("Authorization", "Bearer " + noPermToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "quantityDelta": 1, "movementType": "ADJUSTMENT" }
                                """))
                .andExpect(status().isForbidden());
    }

    // ── 13. Adjust stock on TRASH product/variant returns 400 ────────────────────

    @Test
    void adjustStock_trashProduct_returns400() throws Exception {
        String productId = ensureTestProduct("ProdLevel Trash " + UUID.randomUUID().toString().substring(0, 8));

        // Move product to TRASH
        ProductEntity p = productRepo.findById(productId).orElseThrow();
        p.setPublishStatus(PublishStatus.TRASH);
        productRepo.save(p);

        mockMvc.perform(post("/api/v1/admin/inventory/products/" + productId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "quantityDelta": 5, "movementType": "ADJUSTMENT" }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].code").value("TRASH_PRODUCT"));
    }

    // ── 14. filter_gender removed from handler — Spring ignores unknown query params ──

    @Test
    void publicProductList_filterGender_isIgnoredReturns200() throws Exception {
        // filter_gender was removed from CatalogController (no product gender field exists).
        // Spring MVC does not reject unknown query params, so old bookmarked URLs return 200.
        mockMvc.perform(get("/api/v1/products")
                        .param("filter_gender", "male"))
                .andExpect(status().isOk());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private void ensureAdminUser(String email, String pass, String role) {
        adminUserRepo.findByEmail(email).orElseGet(() -> {
            AdminUserEntity u = new AdminUserEntity();
            u.setEmail(email);
            u.setPasswordHash(passwordService.hash(pass));
            u.setDisplayName("P0Fix Test " + role);
            u.setRole(role);
            u.setStatus("ACTIVE");
            Instant now = Instant.now();
            u.setCreatedAt(now);
            u.setUpdatedAt(now);
            return adminUserRepo.save(u);
        });
    }

    private String loginUser(String email, String pass) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + pass + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String body = r.getResponse().getContentAsString();
        String marker = "\"accessToken\":\"";
        int start = body.indexOf(marker) + marker.length();
        return body.substring(start, body.indexOf("\"", start));
    }

    /** Creates a product WITHOUT variants (product-level stock) and returns the product ID. */
    private String ensureTestProduct(String productName) {
        String catId = "cat-p0fix-pl-" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        CategoryEntity cat = new CategoryEntity();
        cat.setId(catId);
        cat.setSlug("p0fix-pl-cat-" + catId);
        cat.setName("P0Fix PL Category");
        cat.setVisible(true);
        Instant now = Instant.now();
        cat.setCreatedAt(now);
        cat.setUpdatedAt(now);
        categoryRepo.save(cat);

        String productId = UUID.randomUUID().toString();
        ProductEntity product = new ProductEntity();
        product.setId(productId);
        product.setSlug("p0fix-pl-" + productId.replace("-", "").substring(0, 12));
        product.setName(productName);
        product.setRetailPrice(BigDecimal.valueOf(500000));
        product.setCurrency("VND");
        product.setPublishStatus(PublishStatus.PUBLISHED);
        product.setStockState(ProductStockState.IN_STOCK);
        product.setStockQuantity(0);
        product.setManageStock(true);
        product.setCreatedAt(now);
        product.setUpdatedAt(now);
        product.setCategory(cat);
        productRepo.save(product);

        return productId;
    }

    private String ensureTestVariant(String productName) {
        String catId = "cat-p0fix-" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        CategoryEntity cat = new CategoryEntity();
        cat.setId(catId);
        cat.setSlug("p0fix-cat-" + catId);
        cat.setName("P0Fix Category");
        cat.setVisible(true);
        Instant now = Instant.now();
        cat.setCreatedAt(now);
        cat.setUpdatedAt(now);
        categoryRepo.save(cat);

        String productId = UUID.randomUUID().toString();
        ProductEntity product = new ProductEntity();
        product.setId(productId);
        product.setSlug("p0fix-prod-" + productId.replace("-", "").substring(0, 12));
        product.setName(productName);
        product.setRetailPrice(BigDecimal.valueOf(750000));
        product.setCurrency("VND");
        product.setPublishStatus(PublishStatus.PUBLISHED);
        product.setStockState(ProductStockState.IN_STOCK);
        product.setCreatedAt(now);
        product.setUpdatedAt(now);
        product.setCategory(cat);
        productRepo.save(product);

        String variantId = UUID.randomUUID().toString();
        ProductVariantEntity variant = new ProductVariantEntity();
        variant.setId(variantId);
        variant.setProduct(product);
        variant.setName("Standard");
        variant.setSku("P0FIX-SKU-" + variantId.replace("-", "").substring(0, 8));
        variant.setRetailPrice(BigDecimal.valueOf(750000));
        variant.setCurrency("VND");
        variant.setStockState(ProductStockState.IN_STOCK);
        variant.setQuantityOnHand(0);
        variant.setAvailable(true);
        variant.setSortOrder(0);
        variantRepo.save(variant);

        return variantId;
    }
}
