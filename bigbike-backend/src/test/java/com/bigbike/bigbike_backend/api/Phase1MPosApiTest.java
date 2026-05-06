package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
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
class Phase1MPosApiTest {

    private static final String ADMIN_EMAIL = "1m-pos-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS  = "Admin@1M2345678";

    private static final String CASHIER_EMAIL = "1m-cashier-" + UUID.randomUUID() + "@bigbike.test";
    private static final String CASHIER_PASS  = "Cashier@1M2345678";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired ProductJpaRepository productRepo;
    @Autowired ProductVariantJpaRepository variantRepo;
    @Autowired OrderJpaRepository orderRepo;
    @Autowired PaymentJpaRepository paymentRepo;
    @Autowired StockMovementJpaRepository stockMovementRepo;
    @Autowired AuditLogJpaRepository auditLogRepo;
    @Autowired PasswordService passwordService;

    private MockMvc mockMvc;
    private String adminToken;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureAdminUser();
        ensureCashierUser();
        adminToken = loginAdmin();
    }

    // ── 1. POS search — no auth → 401 ────────────────────────────────────────

    @Test
    void posSearch_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/pos/products/search").param("q", "helm"))
                .andExpect(status().isUnauthorized());
    }

    // ── 2. POS search — with auth → 200 ──────────────────────────────────────

    @Test
    void posSearch_withAuth_returns200() throws Exception {
        mockMvc.perform(get("/api/v1/admin/pos/products/search")
                        .param("q", "POS-SEARCH-" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    // ── 3. Create POS CASH order — success, stock decremented once ────────────

    @Test
    void createPosCashOrder_succeeds_completedAndStockDecremented() throws Exception {
        TestVariant tv = createProductWithVariant(10, 300000);

        MvcResult result = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(posOrderBody("CASH", tv.productId, tv.variantId, 2,
                                UUID.randomUUID().toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.paymentStatus").value("PAID"))
                .andExpect(jsonPath("$.data.orderNumber").isNotEmpty())
                .andReturn();

        // Verify stock decremented by 2
        int qtyAfter = variantRepo.findById(tv.variantId).orElseThrow().getQuantityOnHand();
        assertThat(qtyAfter).isEqualTo(8); // 10 - 2
    }

    // ── 4. Create POS order — quantity = 0 → 409 ─────────────────────────────

    @Test
    void createPosOrder_quantityZero_returns409() throws Exception {
        TestVariant tv = createProductWithVariant(5, 100000);

        mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(posOrderBodyWithQty("CASH", tv.productId, tv.variantId, 0,
                                UUID.randomUUID().toString())))
                .andExpect(status().isConflict());
    }

    // ── 5. Create POS order — exceeds stock → 409 ────────────────────────────

    @Test
    void createPosOrder_exceedsStock_returns409() throws Exception {
        TestVariant tv = createProductWithVariant(3, 200000);

        mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(posOrderBodyWithQty("CASH", tv.productId, tv.variantId, 99,
                                UUID.randomUUID().toString())))
                .andExpect(status().isConflict());
    }

    // ── 6. Create POS order — variant not belonging to product → 409 ─────────

    @Test
    void createPosOrder_variantNotBelongingToProduct_returns409() throws Exception {
        TestVariant tvA = createProductWithVariant(5, 100000);
        TestVariant tvB = createProductWithVariant(5, 100000);

        // Submit order for product A but with variant B
        mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(posOrderBodyWithQty("CASH", tvA.productId, tvB.variantId, 1,
                                UUID.randomUUID().toString())))
                .andExpect(status().isConflict());
    }

    // ── 7. Idempotency — retry with same key does not double-decrement ────────

    @Test
    void createPosOrder_idempotencyRetry_doesNotDecrementStockTwice() throws Exception {
        TestVariant tv = createProductWithVariant(10, 500000);
        String idempotencyKey = UUID.randomUUID().toString();

        // First call
        mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(posOrderBodyWithQty("CASH", tv.productId, tv.variantId, 3, idempotencyKey)))
                .andExpect(status().isOk());

        int qtyAfterFirst = variantRepo.findById(tv.variantId).orElseThrow().getQuantityOnHand();
        assertThat(qtyAfterFirst).isEqualTo(7); // 10 - 3

        // Second call — same idempotency key
        mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(posOrderBodyWithQty("CASH", tv.productId, tv.variantId, 3, idempotencyKey)))
                .andExpect(status().isOk());

        int qtyAfterRetry = variantRepo.findById(tv.variantId).orElseThrow().getQuantityOnHand();
        assertThat(qtyAfterRetry).isEqualTo(7); // still 7, not 4
    }

    @Test
    void createPosOrder_noAuth_returns401() throws Exception {
        mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[],\"paymentMethod\":\"CASH\"}"))
                .andExpect(status().isUnauthorized());
    }

    // ── 9. P0 #1 — staffId (createdByAdminId) persisted ─────────────────────

    @Test
    void createPosOrder_staffIdPersisted() throws Exception {
        TestVariant tv = createProductWithVariant(5, 100000);
        UUID adminId = adminUserRepo.findByEmail(ADMIN_EMAIL).orElseThrow().getId();

        MvcResult result = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(posOrderBody("CASH", tv.productId, tv.variantId, 1,
                                UUID.randomUUID().toString())))
                .andExpect(status().isOk())
                .andReturn();

        String orderId = extractJsonString(result.getResponse().getContentAsString(), "orderId");
        var order = orderRepo.findById(UUID.fromString(orderId)).orElseThrow();
        assertThat(order.getCreatedByAdminId()).isEqualTo(adminId);
    }

    // ── 10. P0 #2 — customerName persisted ───────────────────────────────────

    @Test
    void createPosOrder_customerNamePersisted() throws Exception {
        TestVariant tv = createProductWithVariant(5, 100000);

        MvcResult result = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "paymentMethod": "CASH",
                                  "posIdempotencyKey": "%s",
                                  "tenderedAmount": 9999999,
                                  "customerName": "Nguyen Van A",
                                  "items": [{"productId": "%s", "productVariantId": "%s", "quantity": 1}]
                                }
                                """.formatted(UUID.randomUUID(), tv.productId, tv.variantId)))
                .andExpect(status().isOk())
                .andReturn();

        String orderId = extractJsonString(result.getResponse().getContentAsString(), "orderId");
        var order = orderRepo.findById(UUID.fromString(orderId)).orElseThrow();
        assertThat(order.getCustomerName()).isEqualTo("Nguyen Van A");
    }

    // ── 11. P0 #4 — missing productVariantId → 409 ───────────────────────────

    @Test
    void createPosOrder_missingVariantId_returns409() throws Exception {
        TestVariant tv = createProductWithVariant(5, 100000);

        mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "paymentMethod": "CASH",
                                  "posIdempotencyKey": "%s",
                                  "tenderedAmount": 9999999,
                                  "items": [{"productId": "%s", "quantity": 1}]
                                }
                                """.formatted(UUID.randomUUID(), tv.productId)))
                .andExpect(status().isConflict());
    }

    // ── 12. Invalid paymentMethod → 409 ──────────────────────────────────────

    @Test
    void createPosOrder_invalidPaymentMethod_returns409() throws Exception {
        TestVariant tv = createProductWithVariant(5, 100000);

        mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "paymentMethod": "BITCOIN",
                                  "posIdempotencyKey": "%s",
                                  "tenderedAmount": 9999999,
                                  "items": [{"productId": "%s", "productVariantId": "%s", "quantity": 1}]
                                }
                                """.formatted(UUID.randomUUID(), tv.productId, tv.variantId)))
                .andExpect(status().isConflict());
    }

    // ── 13. CASH insufficient tendered → 409 ─────────────────────────────────

    @Test
    void createPosOrder_cashInsufficientTendered_returns409() throws Exception {
        TestVariant tv = createProductWithVariant(5, 200000);

        mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "paymentMethod": "CASH",
                                  "posIdempotencyKey": "%s",
                                  "tenderedAmount": 1,
                                  "items": [{"productId": "%s", "productVariantId": "%s", "quantity": 1}]
                                }
                                """.formatted(UUID.randomUUID(), tv.productId, tv.variantId)))
                .andExpect(status().isConflict());
    }

    // ── 14. P0 #5 — priceOverride without pos.price_override → 409 ───────────

    @Test
    void createPosOrder_priceOverride_withoutPermission_returns409() throws Exception {
        String cashierToken = loginCashier();
        TestVariant tv = createProductWithVariant(5, 100000);

        mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + cashierToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "paymentMethod": "CASH",
                                  "posIdempotencyKey": "%s",
                                  "tenderedAmount": 9999999,
                                  "items": [{"productId": "%s", "productVariantId": "%s", "quantity": 1,
                                             "unitPriceOverride": 50000}]
                                }
                                """.formatted(UUID.randomUUID(), tv.productId, tv.variantId)))
                .andExpect(status().isConflict());
    }

    // ── 15. P0 #5 — priceOverride with pos.price_override → 200, correct total

    @Test
    void createPosOrder_priceOverride_withPermission_succeeds() throws Exception {
        TestVariant tv = createProductWithVariant(5, 100000);

        mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "paymentMethod": "CASH",
                                  "posIdempotencyKey": "%s",
                                  "tenderedAmount": 9999999,
                                  "items": [{"productId": "%s", "productVariantId": "%s", "quantity": 1,
                                             "unitPriceOverride": 50000}]
                                }
                                """.formatted(UUID.randomUUID(), tv.productId, tv.variantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalAmount").value(50000.0));
    }

    // ── 16. Payment record created ────────────────────────────────────────────

    @Test
    void createPosOrder_paymentRecordCreated() throws Exception {
        TestVariant tv = createProductWithVariant(5, 300000);

        MvcResult result = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(posOrderBody("CASH", tv.productId, tv.variantId, 1,
                                UUID.randomUUID().toString())))
                .andExpect(status().isOk())
                .andReturn();

        String orderId = extractJsonString(result.getResponse().getContentAsString(), "orderId");
        var payments = paymentRepo.findByOrderId(UUID.fromString(orderId));
        assertThat(payments).isNotEmpty();
        assertThat(payments.get(0).getStatus()).isEqualTo("PAID");
    }

    // ── 17. Stock movement created ────────────────────────────────────────────

    @Test
    void createPosOrder_stockMovementCreated() throws Exception {
        TestVariant tv = createProductWithVariant(5, 100000);

        MvcResult result = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(posOrderBody("CASH", tv.productId, tv.variantId, 2,
                                UUID.randomUUID().toString())))
                .andExpect(status().isOk())
                .andReturn();

        String orderId = extractJsonString(result.getResponse().getContentAsString(), "orderId");
        boolean exists = stockMovementRepo.existsByReferenceTypeAndReferenceId(
                "ORDER", UUID.fromString(orderId));
        assertThat(exists).isTrue();
    }

    // ── 18. Audit log POS_ORDER_CREATED written ───────────────────────────────

    @Test
    void createPosOrder_auditLogCreated() throws Exception {
        TestVariant tv = createProductWithVariant(5, 100000);

        MvcResult result = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(posOrderBody("CASH", tv.productId, tv.variantId, 1,
                                UUID.randomUUID().toString())))
                .andExpect(status().isOk())
                .andReturn();

        String orderId = extractJsonString(result.getResponse().getContentAsString(), "orderId");
        var logs = auditLogRepo.findByResourceTypeAndResourceId(
                "ORDER", UUID.fromString(orderId));
        assertThat(logs).isNotEmpty();
        assertThat(logs.get(0).getAction()).isEqualTo("POS_ORDER_CREATED");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private record TestVariant(String productId, String variantId) {}

    private TestVariant createProductWithVariant(int stock, int price) {
        Instant now = Instant.now();
        String catId = "cat-1m-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity cat = new CategoryEntity();
        cat.setId(catId);
        cat.setSlug("1m-cat-" + catId);
        cat.setName("Phase1M Test Cat");
        cat.setVisible(true);
        cat.setCreatedAt(now);
        cat.setUpdatedAt(now);
        categoryRepo.save(cat);

        String productId = UUID.randomUUID().toString();
        ProductEntity product = new ProductEntity();
        product.setId(productId);
        product.setSlug("1m-" + productId.replace("-", "").substring(0, 12));
        product.setName("Phase1M Product " + productId.substring(0, 8));
        product.setRetailPrice(BigDecimal.valueOf(price));
        product.setCurrency("VND");
        product.setPublishStatus(PublishStatus.PUBLISHED);
        product.setStockState(stock > 0 ? ProductStockState.IN_STOCK : ProductStockState.OUT_OF_STOCK);
        product.setCreatedAt(now);
        product.setUpdatedAt(now);
        product.setCategory(cat);
        productRepo.save(product);

        String variantId = UUID.randomUUID().toString();
        ProductVariantEntity variant = new ProductVariantEntity();
        variant.setId(variantId);
        variant.setProduct(product);
        variant.setName("Default");
        variant.setSku("1M-" + variantId.replace("-", "").substring(0, 8));
        variant.setRetailPrice(BigDecimal.valueOf(price));
        variant.setCurrency("VND");
        variant.setStockState(stock > 0 ? ProductStockState.IN_STOCK : ProductStockState.OUT_OF_STOCK);
        variant.setQuantityOnHand(stock);
        variant.setAvailable(true);
        variant.setSortOrder(0);
        variantRepo.save(variant);

        return new TestVariant(productId, variantId);
    }

    private String posOrderBody(String method, String productId, String variantId, int qty, String idempotencyKey) {
        return posOrderBodyWithQty(method, productId, variantId, qty, idempotencyKey);
    }

    private String posOrderBodyWithQty(String method, String productId, String variantId, int qty, String idempotencyKey) {
        return """
                {
                  "paymentMethod": "%s",
                  "posIdempotencyKey": "%s",
                  "tenderedAmount": %d,
                  "items": [
                    {
                      "productId": "%s",
                      "productVariantId": "%s",
                      "quantity": %d
                    }
                  ]
                }
                """.formatted(method, idempotencyKey, 9999999, productId, variantId, qty);
    }

    private void ensureAdminUser() {
        adminUserRepo.findByEmail(ADMIN_EMAIL).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(ADMIN_EMAIL);
            admin.setPasswordHash(passwordService.hash(ADMIN_PASS));
            admin.setDisplayName("Phase1M POS Admin");
            admin.setRole("ADMIN");
            admin.setStatus("ACTIVE");
            Instant now = Instant.now();
            admin.setCreatedAt(now);
            admin.setUpdatedAt(now);
            return adminUserRepo.save(admin);
        });
    }

    private void ensureCashierUser() {
        adminUserRepo.findByEmail(CASHIER_EMAIL).orElseGet(() -> {
            AdminUserEntity cashier = new AdminUserEntity();
            cashier.setEmail(CASHIER_EMAIL);
            cashier.setPasswordHash(passwordService.hash(CASHIER_PASS));
            cashier.setDisplayName("Phase1M POS Cashier");
            cashier.setRole("CASHIER");
            cashier.setStatus("ACTIVE");
            Instant now = Instant.now();
            cashier.setCreatedAt(now);
            cashier.setUpdatedAt(now);
            return adminUserRepo.save(cashier);
        });
    }

    private String loginAdmin() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + ADMIN_EMAIL + "\",\"password\":\"" + ADMIN_PASS + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return extractJsonString(result.getResponse().getContentAsString(), "accessToken");
    }

    private String loginCashier() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + CASHIER_EMAIL + "\",\"password\":\"" + CASHIER_PASS + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return extractJsonString(result.getResponse().getContentAsString(), "accessToken");
    }

    private String extractJsonString(String json, String key) {
        String marker = "\"" + key + "\":\"";
        int start = json.indexOf(marker);
        if (start < 0) return null;
        start += marker.length();
        int end = json.indexOf("\"", start);
        return json.substring(start, end);
    }

    private String extractJsonUuid(String json, String key) {
        return extractJsonString(json, key);
    }
}
