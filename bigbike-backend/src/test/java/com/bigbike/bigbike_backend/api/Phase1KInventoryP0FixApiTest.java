package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
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

/**
 * Inventory availability toggle (boolean model — owner decision 2026-06-23).
 * Inventory is "còn hàng / hết hàng" only: a per-variant {@code is_available} toggle and a
 * single {@code stock_state} toggle for no-variant products. There are no quantities, no
 * stock movements written for the toggle, and no decrement/restore on sale/cancel.
 */
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

    // ── 1. Setting a variant out of stock flips is_available + stock_state ────────

    @Test
    void setVariantUnavailable_flipsAvailabilityAndState() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/inventory/variants/" + testVariantId + "/availability")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"available\": false }"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.stockState").value("OUT_OF_STOCK"));

        ProductVariantEntity after = variantRepo.findById(testVariantId).orElseThrow();
        assertThat(after.isAvailable()).isFalse();
        assertThat(after.getStockState()).isEqualTo(ProductStockState.OUT_OF_STOCK);
    }

    // ── 2. Setting a variant in stock flips it back to available + IN_STOCK ───────

    @Test
    void setVariantAvailable_flipsBackToInStock() throws Exception {
        // first set out
        mockMvc.perform(patch("/api/v1/admin/inventory/variants/" + testVariantId + "/availability")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"available\": false }"))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/v1/admin/inventory/variants/" + testVariantId + "/availability")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"available\": true }"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.stockState").value("IN_STOCK"));

        assertThat(variantRepo.findById(testVariantId).orElseThrow().isAvailable()).isTrue();
    }

    // ── 3. Missing 'available' field is rejected (Bean Validation) ────────────────

    @Test
    void setVariantAvailability_missingField_returns400() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/inventory/variants/" + testVariantId + "/availability")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ }"))
                .andExpect(status().isBadRequest());
    }

    // ── 4. CSV export requires authentication ────────────────────────────────────

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

    // ── 5. Permission denied for availability toggle without inventory.write ──────

    @Test
    void setAvailability_withViewerRole_returns403() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/inventory/variants/" + testVariantId + "/availability")
                        .header("Authorization", "Bearer " + noPermToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"available\": false }"))
                .andExpect(status().isForbidden());
    }

    // ── 6. Product-level (no-variant) availability toggle ────────────────────────

    @Test
    void setProductUnavailable_setsOutOfStock() throws Exception {
        String productId = ensureTestProduct("ProdLevel Avail " + UUID.randomUUID().toString().substring(0, 8));

        mockMvc.perform(patch("/api/v1/admin/inventory/products/" + productId + "/availability")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"available\": false }"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.stockState").value("OUT_OF_STOCK"))
                .andExpect(jsonPath("$.variantId").doesNotExist());

        ProductEntity updated = productRepo.findById(productId).orElseThrow();
        assertThat(updated.getStockState()).isEqualTo(ProductStockState.OUT_OF_STOCK);
    }

    // ── 7. Product-level availability toggle requires inventory.write permission ──

    @Test
    void productLevelAvailability_requiresInventoryWritePermission() throws Exception {
        String productId = ensureTestProduct("ProdLevel Perm " + UUID.randomUUID().toString().substring(0, 8));

        mockMvc.perform(patch("/api/v1/admin/inventory/products/" + productId + "/availability")
                        .header("Authorization", "Bearer " + noPermToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"available\": true }"))
                .andExpect(status().isForbidden());
    }

    // ── 8. Availability toggle on a TRASH product returns 400 ────────────────────

    @Test
    void setAvailability_trashProduct_returns400() throws Exception {
        String productId = ensureTestProduct("ProdLevel Trash " + UUID.randomUUID().toString().substring(0, 8));

        ProductEntity p = productRepo.findById(productId).orElseThrow();
        p.setPublishStatus(PublishStatus.TRASH);
        productRepo.save(p);

        mockMvc.perform(patch("/api/v1/admin/inventory/products/" + productId + "/availability")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"available\": false }"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].code").value("TRASH_PRODUCT"));
    }

    // ── 9. filter_gender removed from handler — Spring ignores unknown query params ──

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

    /** Creates a product WITHOUT variants (product-level availability) and returns the product ID. */
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
        variant.setAvailable(true);
        variant.setSortOrder(0);
        variantRepo.save(variant);

        return variantId;
    }
}
