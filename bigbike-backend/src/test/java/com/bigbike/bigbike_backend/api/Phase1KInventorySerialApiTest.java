package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementSerialJpaRepository;
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

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class Phase1KInventorySerialApiTest {

    private static final String ADMIN_EMAIL = "1k-admin-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS  = "Admin@1K2345678";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired ProductJpaRepository productRepo;
    @Autowired ProductVariantJpaRepository variantRepo;
    @Autowired StockMovementSerialJpaRepository serialRepo;
    @Autowired PasswordService passwordService;

    private MockMvc mockMvc;
    private String adminToken;
    private String testVariantId;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureAdminUser();
        adminToken = loginAdmin();
        testVariantId = ensureTestVariant();
    }

    // ── 1. Stock in with valid serials → 200, serials saved ─────────────────────

    @Test
    void stockIn_withValidSerials_succeeds() throws Exception {
        String s1 = "SN-1K-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String s2 = "SN-1K-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String s3 = "SN-1K-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);

        MvcResult result = mockMvc.perform(post("/api/v1/admin/inventory/variants/" + testVariantId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "quantityDelta": 3,
                                  "movementType": "IN",
                                  "note": "Serial test import",
                                  "serialNumbers": ["%s", "%s", "%s"]
                                }
                                """.formatted(s1, s2, s3)))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).isNotEmpty();

        // Verify serials were persisted in DB
        assertThat(serialRepo.findExistingSerialNumbers(java.util.List.of(s1, s2, s3)))
                .containsExactlyInAnyOrder(s1, s2, s3);
    }

    // ── 2. Serial count > quantity → 400 ────────────────────────────────────────

    @Test
    void stockIn_serialCountExceedsQuantity_returns400() throws Exception {
        String s1 = "SN-OVER-" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        String s2 = "SN-OVER-" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        String s3 = "SN-OVER-" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);

        mockMvc.perform(post("/api/v1/admin/inventory/variants/" + testVariantId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "quantityDelta": 2,
                                  "movementType": "IN",
                                  "serialNumbers": ["%s", "%s", "%s"]
                                }
                                """.formatted(s1, s2, s3)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].code").value("COUNT_EXCEEDS_QUANTITY"));
    }

    // ── 3. Duplicate serial within the same request → 400 ───────────────────────

    @Test
    void stockIn_duplicateSerialInRequest_returns400() throws Exception {
        String dup = "SN-DUP-" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);

        mockMvc.perform(post("/api/v1/admin/inventory/variants/" + testVariantId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "quantityDelta": 3,
                                  "movementType": "IN",
                                  "serialNumbers": ["%s", "%s"]
                                }
                                """.formatted(dup, dup)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].code").value("DUPLICATE_IN_REQUEST"));
    }

    // ── 4. Serial already exists in DB → 400 ────────────────────────────────────

    @Test
    void stockIn_serialAlreadyInDb_returns400() throws Exception {
        // First import: register a serial
        String existing = "SN-EXISTS-" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        mockMvc.perform(post("/api/v1/admin/inventory/variants/" + testVariantId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "quantityDelta": 1,
                                  "movementType": "IN",
                                  "serialNumbers": ["%s"]
                                }
                                """.formatted(existing)))
                .andExpect(status().isOk());

        // Second import: try to use the same serial → should fail
        mockMvc.perform(post("/api/v1/admin/inventory/variants/" + testVariantId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "quantityDelta": 1,
                                  "movementType": "IN",
                                  "serialNumbers": ["%s"]
                                }
                                """.formatted(existing)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].code").value("ALREADY_EXISTS"));
    }

    // ── 5. Transaction rollback: rejected serial → quantity unchanged ────────────

    @Test
    void stockIn_invalidSerial_quantityUnchanged() throws Exception {
        // Record current quantity
        ProductVariantEntity before = variantRepo.findById(testVariantId).orElseThrow();
        int qtyBefore = before.getQuantityOnHand();

        // Attempt with duplicate serials (will be rejected)
        String dup = "SN-ROLLBACK-" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        mockMvc.perform(post("/api/v1/admin/inventory/variants/" + testVariantId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "quantityDelta": 5,
                                  "movementType": "IN",
                                  "serialNumbers": ["%s", "%s"]
                                }
                                """.formatted(dup, dup)))
                .andExpect(status().isBadRequest());

        // Quantity must be unchanged
        ProductVariantEntity after = variantRepo.findById(testVariantId).orElseThrow();
        assertThat(after.getQuantityOnHand()).isEqualTo(qtyBefore);
    }

    // ── 6. Stock in without serials → 400 (serials now required for IN) ─────────

    @Test
    void stockIn_withoutSerials_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/admin/inventory/variants/" + testVariantId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "quantityDelta": 2,
                                  "movementType": "IN",
                                  "note": "No serials"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].code").value("REQUIRED_FOR_STOCK_IN"));
    }

    // ── 8. Stock in with too few serials → 400 ───────────────────────────────────

    @Test
    void stockIn_serialCountFewerThanQuantity_returns200() throws Exception {
        // Providing fewer serials than quantityDelta is allowed (partial serial tracking).
        String s1 = "SN-FEW-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);

        mockMvc.perform(post("/api/v1/admin/inventory/variants/" + testVariantId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "quantityDelta": 3,
                                  "movementType": "IN",
                                  "serialNumbers": ["%s"]
                                }
                                """.formatted(s1)))
                .andExpect(status().isOk());
    }

    // ── 7. Movement list includes serialCount field ──────────────────────────────

    @Test
    void movementList_includesSerialCount() throws Exception {
        // Import with 2 serials
        String s1 = "SN-CNT-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String s2 = "SN-CNT-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        mockMvc.perform(post("/api/v1/admin/inventory/variants/" + testVariantId + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "quantityDelta": 2,
                                  "movementType": "IN",
                                  "serialNumbers": ["%s", "%s"]
                                }
                                """.formatted(s1, s2)))
                .andExpect(status().isOk());

        // Fetch movements list and verify serialCount field is present in response
        mockMvc.perform(get("/api/v1/admin/inventory/movements")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("page", "1")
                        .param("size", "5")
                        .param("movementType", "IN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].serialCount").isNumber());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private void ensureAdminUser() {
        adminUserRepo.findByEmail(ADMIN_EMAIL).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(ADMIN_EMAIL);
            admin.setPasswordHash(passwordService.hash(ADMIN_PASS));
            admin.setDisplayName("Phase1K Test Admin");
            admin.setRole("ADMIN");
            admin.setStatus("ACTIVE");
            Instant now = Instant.now();
            admin.setCreatedAt(now);
            admin.setUpdatedAt(now);
            return adminUserRepo.save(admin);
        });
    }

    private String loginAdmin() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + ADMIN_EMAIL + "\",\"password\":\"" + ADMIN_PASS + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String body = result.getResponse().getContentAsString();
        String marker = "\"accessToken\":\"";
        int start = body.indexOf(marker);
        if (start < 0) throw new IllegalStateException("accessToken not found in login response");
        start += marker.length();
        int end = body.indexOf("\"", start);
        return body.substring(start, end);
    }

    private String ensureTestVariant() {
        // Create a fresh category + product + variant for isolation
        String catId = "cat-1k-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity cat = new CategoryEntity();
        cat.setId(catId);
        cat.setSlug("1k-cat-" + catId);
        cat.setName("Phase1K Test Category");
        cat.setVisible(true);
        Instant now = Instant.now();
        cat.setCreatedAt(now);
        cat.setUpdatedAt(now);
        categoryRepo.save(cat);

        String productId = UUID.randomUUID().toString();
        ProductEntity product = new ProductEntity();
        product.setId(productId);
        product.setSlug("1k-product-" + productId.replace("-", "").substring(0, 12));
        product.setName("Phase1K Test Product");
        product.setRetailPrice(BigDecimal.valueOf(500000));
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
        variant.setName("Default");
        variant.setSku("1K-SKU-" + variantId.replace("-", "").substring(0, 8));
        variant.setRetailPrice(BigDecimal.valueOf(500000));
        variant.setCurrency("VND");
        variant.setStockState(ProductStockState.IN_STOCK);
        variant.setQuantityOnHand(0);
        variant.setAvailable(true);
        variant.setSortOrder(0);
        variantRepo.save(variant);

        return variantId;
    }
}
