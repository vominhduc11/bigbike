package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.domain.catalog.ProductSerialStatus;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSerialEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductSerialJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementJpaRepository;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.receivable.ReceivableJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.warranty.WarrantyRecordJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
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

    private static final String SHOP_MGR_EMAIL = "1m-shopmgr-" + UUID.randomUUID() + "@bigbike.test";
    private static final String SHOP_MGR_PASS  = "ShopMgr@1M2345678";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired ProductJpaRepository productRepo;
    @Autowired ProductVariantJpaRepository variantRepo;
    @Autowired OrderJpaRepository orderRepo;
    @Autowired PaymentJpaRepository paymentRepo;
    @Autowired StockMovementJpaRepository stockMovementRepo;
    @Autowired AuditLogJpaRepository auditLogRepo;
    @Autowired ReceivableJpaRepository receivableRepo;
    @Autowired CustomerJpaRepository customerRepo;
    @Autowired ProductSerialJpaRepository serialRepo;
    @Autowired WarrantyRecordJpaRepository warrantyRepo;
    @Autowired PasswordService passwordService;

    private MockMvc mockMvc;
    private String adminToken;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureAdminUser();
        ensureShopManagerUser();
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
        String cashierToken = loginShopManager();
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

    // ── CREDIT tests (POSREC-003) ─────────────────────────────────────────────

    @Test
    void createPosCreditOrder_withoutDownPayment_createsCompletedUnpaidOrderAndReceivable() throws Exception {
        TestVariant tv = createProductWithVariant(5, 200000);
        CustomerEntity customer = createCreditCustomer(new BigDecimal("10000000"));
        String idempotencyKey = UUID.randomUUID().toString();

        MvcResult result = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "paymentMethod": "CREDIT",
                                  "posIdempotencyKey": "%s",
                                  "customerId": "%s",
                                  "items": [{"productId": "%s", "productVariantId": "%s", "quantity": 1}]
                                }
                                """.formatted(idempotencyKey, customer.getId(), tv.productId, tv.variantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.paymentStatus").value("UNPAID"))
                .andReturn();

        String orderId = extractJsonString(result.getResponse().getContentAsString(), "orderId");
        var arOpt = receivableRepo.findByOrderId(UUID.fromString(orderId));
        assertThat(arOpt).isPresent();
        assertThat(arOpt.get().getStatus()).isEqualTo("OPEN");
        assertThat(arOpt.get().getOutstandingAmount()).isEqualByComparingTo(new BigDecimal("200000"));
    }

    @Test
    void createPosCreditOrder_withDownPayment_createsPartiallyPaidOrderPaymentAndReceivable() throws Exception {
        TestVariant tv = createProductWithVariant(5, 1000000);
        CustomerEntity customer = createCreditCustomer(new BigDecimal("10000000"));
        String idempotencyKey = UUID.randomUUID().toString();

        MvcResult result = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "paymentMethod": "CREDIT",
                                  "posIdempotencyKey": "%s",
                                  "customerId": "%s",
                                  "downPayment": 300000,
                                  "items": [{"productId": "%s", "productVariantId": "%s", "quantity": 1}]
                                }
                                """.formatted(idempotencyKey, customer.getId(), tv.productId, tv.variantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentStatus").value("PARTIALLY_PAID"))
                .andReturn();

        String orderId = extractJsonString(result.getResponse().getContentAsString(), "orderId");
        // Receivable outstanding = 1000000 - 300000 = 700000
        var arOpt = receivableRepo.findByOrderId(UUID.fromString(orderId));
        assertThat(arOpt).isPresent();
        assertThat(arOpt.get().getOutstandingAmount()).isEqualByComparingTo(new BigDecimal("700000"));
        assertThat(arOpt.get().getPaidAmount()).isEqualByComparingTo(new BigDecimal("300000"));
        // Payment record created for down payment
        var payments = paymentRepo.findByOrderId(UUID.fromString(orderId));
        assertThat(payments).isNotEmpty();
        assertThat(payments.get(0).getAmount()).isEqualByComparingTo(new BigDecimal("300000"));
    }

    @Test
    void createPosCreditOrder_requiresCustomerId_returns409() throws Exception {
        TestVariant tv = createProductWithVariant(5, 100000);

        mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "paymentMethod": "CREDIT",
                                  "posIdempotencyKey": "%s",
                                  "items": [{"productId": "%s", "productVariantId": "%s", "quantity": 1}]
                                }
                                """.formatted(UUID.randomUUID(), tv.productId, tv.variantId)))
                .andExpect(status().isConflict());
    }

    @Test
    void createPosCreditOrder_rejectsCreditDisabledCustomer_returns409() throws Exception {
        TestVariant tv = createProductWithVariant(5, 100000);
        CustomerEntity customer = createCreditCustomer(new BigDecimal("10000000"));
        customer.setCreditEnabled(false);
        customerRepo.save(customer);

        mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "paymentMethod": "CREDIT",
                                  "posIdempotencyKey": "%s",
                                  "customerId": "%s",
                                  "items": [{"productId": "%s", "productVariantId": "%s", "quantity": 1}]
                                }
                                """.formatted(UUID.randomUUID(), customer.getId(), tv.productId, tv.variantId)))
                .andExpect(status().isConflict());
    }

    @Test
    void createPosCreditOrder_rejectsCreditLimitExceeded_returns409() throws Exception {
        // Credit limit = 50000, order total = 100000 -> exceeds
        // Must use SHOP_MANAGER token (no override_limit permission)
        String shopMgrToken = loginShopManager();
        TestVariant tv = createProductWithVariant(5, 100000);
        CustomerEntity customer = createCreditCustomer(new BigDecimal("50000"));

        mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + shopMgrToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "paymentMethod": "CREDIT",
                                  "posIdempotencyKey": "%s",
                                  "customerId": "%s",
                                  "items": [{"productId": "%s", "productVariantId": "%s", "quantity": 1}]
                                }
                                """.formatted(UUID.randomUUID(), customer.getId(), tv.productId, tv.variantId)))
                .andExpect(status().isConflict());
    }

    // POSREC-009 — override_limit permission tests
    @Test
    void creditSale_shopManager_overCreditLimit_returns409() throws Exception {
        String shopMgrToken = loginShopManager();
        // Credit limit = 50000, order total = 100000 -> SHOP_MANAGER cannot override
        TestVariant tv = createProductWithVariant(5, 100000);
        CustomerEntity customer = createCreditCustomer(new BigDecimal("50000"));

        mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + shopMgrToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "paymentMethod": "CREDIT",
                                  "posIdempotencyKey": "%s",
                                  "customerId": "%s",
                                  "items": [{"productId": "%s", "productVariantId": "%s", "quantity": 1}]
                                }
                                """.formatted(UUID.randomUUID(), customer.getId(), tv.productId, tv.variantId)))
                .andExpect(status().isConflict());
    }

    @Test
    void creditSale_admin_overCreditLimit_withOverridePerm_returns200() throws Exception {
        // ADMIN has receivables.override_limit permission -> allowed even over limit
        TestVariant tv = createProductWithVariant(5, 100000);
        CustomerEntity customer = createCreditCustomer(new BigDecimal("50000"));

        mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "paymentMethod": "CREDIT",
                                  "posIdempotencyKey": "%s",
                                  "customerId": "%s",
                                  "items": [{"productId": "%s", "productVariantId": "%s", "quantity": 1}]
                                }
                                """.formatted(UUID.randomUUID(), customer.getId(), tv.productId, tv.variantId)))
                .andExpect(status().isOk());
    }

    @Test
    void createPosCreditOrder_decrementsStock_andWritesMovement() throws Exception {
        TestVariant tv = createProductWithVariant(10, 200000);
        CustomerEntity customer = createCreditCustomer(new BigDecimal("10000000"));
        String idempotencyKey = UUID.randomUUID().toString();

        MvcResult result = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "paymentMethod": "CREDIT",
                                  "posIdempotencyKey": "%s",
                                  "customerId": "%s",
                                  "items": [{"productId": "%s", "productVariantId": "%s", "quantity": 3}]
                                }
                                """.formatted(idempotencyKey, customer.getId(), tv.productId, tv.variantId)))
                .andExpect(status().isOk())
                .andReturn();

        int qtyAfter = variantRepo.findById(tv.variantId).orElseThrow().getQuantityOnHand();
        assertThat(qtyAfter).isEqualTo(7); // 10 - 3

        String orderId = extractJsonString(result.getResponse().getContentAsString(), "orderId");
        assertThat(stockMovementRepo.existsByReferenceTypeAndReferenceId("ORDER", UUID.fromString(orderId))).isTrue();
    }

    @Test
    void createPosCreditOrder_idempotency_doesNotCreateDuplicateReceivable() throws Exception {
        TestVariant tv = createProductWithVariant(10, 300000);
        CustomerEntity customer = createCreditCustomer(new BigDecimal("10000000"));
        String idempotencyKey = UUID.randomUUID().toString();

        String body = """
                {
                  "paymentMethod": "CREDIT",
                  "posIdempotencyKey": "%s",
                  "customerId": "%s",
                  "items": [{"productId": "%s", "productVariantId": "%s", "quantity": 1}]
                }
                """.formatted(idempotencyKey, customer.getId(), tv.productId, tv.variantId);

        MvcResult result1 = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();

        // Retry with same key
        mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        String orderId = extractJsonString(result1.getResponse().getContentAsString(), "orderId");
        // Only one receivable should exist for this order
        long arCount = receivableRepo.findAll().stream()
                .filter(ar -> ar.getOrderId().equals(UUID.fromString(orderId)))
                .count();
        assertThat(arCount).isEqualTo(1);
    }

    // POSREC-010 — Audit afterData has paymentMethod field
    @Test
    void createPosCashOrder_auditAfterDataHasPaymentMethod() throws Exception {
        TestVariant tv = createProductWithVariant(5, 100000);

        MvcResult result = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(posOrderBody("CASH", tv.productId, tv.variantId, 1,
                                UUID.randomUUID().toString())))
                .andExpect(status().isOk())
                .andReturn();

        String orderId = extractJsonString(result.getResponse().getContentAsString(), "orderId");
        var logs = auditLogRepo.findByResourceTypeAndResourceId("ORDER", UUID.fromString(orderId));
        assertThat(logs).isNotEmpty();
        assertThat(logs.get(0).getAfterData()).contains("\"paymentMethod\"");
        assertThat(logs.get(0).getAfterData()).contains("CASH");
    }

    @Test
    void createPosCreditOrder_auditAfterDataHasPaymentMethodCredit() throws Exception {
        TestVariant tv = createProductWithVariant(5, 100000);
        CustomerEntity customer = createCreditCustomer(new BigDecimal("10000000"));

        MvcResult result = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "paymentMethod": "CREDIT",
                                  "posIdempotencyKey": "%s",
                                  "customerId": "%s",
                                  "items": [{"productId": "%s", "productVariantId": "%s", "quantity": 1}]
                                }
                                """.formatted(UUID.randomUUID(), customer.getId(), tv.productId, tv.variantId)))
                .andExpect(status().isOk())
                .andReturn();

        String orderId = extractJsonString(result.getResponse().getContentAsString(), "orderId");
        var logs = auditLogRepo.findByResourceTypeAndResourceId("ORDER", UUID.fromString(orderId));
        assertThat(logs).isNotEmpty();
        assertThat(logs.get(0).getAfterData()).contains("\"paymentMethod\"");
        assertThat(logs.get(0).getAfterData()).contains("CREDIT");
    }

    // ── POS Refund flow ──────────────────────────────────────────────────────

    @Test
    void posRefund_cashFullRefund_setsRefundedAndRestoresStock() throws Exception {
        TestVariant tv = createProductWithVariant(10, 200000);

        MvcResult createRes = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(posOrderBody("CASH", tv.productId, tv.variantId, 2,
                                UUID.randomUUID().toString())))
                .andExpect(status().isOk())
                .andReturn();
        String orderId = extractJsonString(createRes.getResponse().getContentAsString(), "orderId");
        int qtyAfterSale = variantRepo.findById(tv.variantId).orElseThrow().getQuantityOnHand();
        assertThat(qtyAfterSale).isEqualTo(8);

        // Full refund: 200000 × 2 = 400000
        mockMvc.perform(post("/api/v1/admin/pos/orders/" + orderId + "/refund")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":400000,\"reason\":\"Khách yêu cầu huỷ\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REFUND_APPLIED"));

        var order = orderRepo.findById(UUID.fromString(orderId)).orElseThrow();
        assertThat(order.getStatus()).isEqualTo("REFUNDED");
        assertThat(order.getPaymentStatus()).isEqualTo("REFUNDED");
        assertThat(order.getRefundAmount()).isEqualByComparingTo(new BigDecimal("400000"));
        assertThat(order.getRefundedAt()).isNotNull();

        // Stock restored for non-serial variant (8 + 2 = 10)
        int qtyAfterRefund = variantRepo.findById(tv.variantId).orElseThrow().getQuantityOnHand();
        assertThat(qtyAfterRefund).isEqualTo(10);
        assertThat(stockMovementRepo.existsByReferenceTypeAndReferenceId("ORDER_REFUND",
                UUID.fromString(orderId))).isTrue();

        // Audit log written
        var refundLogs = auditLogRepo.findByResourceTypeAndResourceId("ORDER", UUID.fromString(orderId))
                .stream().filter(l -> "ORDER_REFUND_CREATED".equals(l.getAction())).toList();
        assertThat(refundLogs).isNotEmpty();
    }

    @Test
    void posRefund_cashPartialRefund_setsPartiallyRefundedAndDoesNotRestoreStock() throws Exception {
        TestVariant tv = createProductWithVariant(10, 200000);

        MvcResult createRes = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(posOrderBody("CASH", tv.productId, tv.variantId, 2,
                                UUID.randomUUID().toString())))
                .andExpect(status().isOk())
                .andReturn();
        String orderId = extractJsonString(createRes.getResponse().getContentAsString(), "orderId");

        // Partial refund: 150000 of 400000
        mockMvc.perform(post("/api/v1/admin/pos/orders/" + orderId + "/refund")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":150000,\"reason\":\"Lập sai giá\"}"))
                .andExpect(status().isOk());

        var order = orderRepo.findById(UUID.fromString(orderId)).orElseThrow();
        assertThat(order.getStatus()).isEqualTo("COMPLETED"); // not flipped on partial
        assertThat(order.getPaymentStatus()).isEqualTo("PARTIALLY_REFUNDED");
        assertThat(order.getRefundAmount()).isEqualByComparingTo(new BigDecimal("150000"));

        // Stock NOT restored on partial refund
        int qtyAfterPartial = variantRepo.findById(tv.variantId).orElseThrow().getQuantityOnHand();
        assertThat(qtyAfterPartial).isEqualTo(8);
        assertThat(stockMovementRepo.existsByReferenceTypeAndReferenceId("ORDER_REFUND",
                UUID.fromString(orderId))).isFalse();

        // Second refund completes the remaining 250000 → flips to REFUNDED + restores stock
        mockMvc.perform(post("/api/v1/admin/pos/orders/" + orderId + "/refund")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":250000,\"reason\":\"Khách yêu cầu huỷ\"}"))
                .andExpect(status().isOk());

        var orderAfter = orderRepo.findById(UUID.fromString(orderId)).orElseThrow();
        assertThat(orderAfter.getPaymentStatus()).isEqualTo("REFUNDED");
        assertThat(orderAfter.getStatus()).isEqualTo("REFUNDED");
        int qtyAfterFull = variantRepo.findById(tv.variantId).orElseThrow().getQuantityOnHand();
        assertThat(qtyAfterFull).isEqualTo(10);
    }

    @Test
    void posRefund_creditUnpaidOrder_returns409() throws Exception {
        TestVariant tv = createProductWithVariant(10, 300000);
        CustomerEntity customer = createCreditCustomer(new BigDecimal("10000000"));

        MvcResult createRes = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "paymentMethod": "CREDIT",
                                  "posIdempotencyKey": "%s",
                                  "customerId": "%s",
                                  "items": [{"productId": "%s", "productVariantId": "%s", "quantity": 1}]
                                }
                                """.formatted(UUID.randomUUID(), customer.getId(), tv.productId, tv.variantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentStatus").value("UNPAID"))
                .andReturn();
        String orderId = extractJsonString(createRes.getResponse().getContentAsString(), "orderId");

        // Refunding an UNPAID credit order must be rejected
        mockMvc.perform(post("/api/v1/admin/pos/orders/" + orderId + "/refund")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":300000,\"reason\":\"Khách yêu cầu huỷ\"}"))
                .andExpect(status().isConflict());

        var order = orderRepo.findById(UUID.fromString(orderId)).orElseThrow();
        assertThat(order.getRefundAmount()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void posRefund_exceedsPaidAmount_returns400() throws Exception {
        TestVariant tv = createProductWithVariant(10, 100000);

        MvcResult createRes = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(posOrderBody("CASH", tv.productId, tv.variantId, 1,
                                UUID.randomUUID().toString())))
                .andExpect(status().isOk())
                .andReturn();
        String orderId = extractJsonString(createRes.getResponse().getContentAsString(), "orderId");

        // Try to refund 200000 when only 100000 was paid
        mockMvc.perform(post("/api/v1/admin/pos/orders/" + orderId + "/refund")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":200000,\"reason\":\"Lập sai giá\"}"))
                .andExpect(status().isBadRequest());

        var order = orderRepo.findById(UUID.fromString(orderId)).orElseThrow();
        assertThat(order.getRefundAmount()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void posRefund_noAuth_returns401() throws Exception {
        mockMvc.perform(post("/api/v1/admin/pos/orders/" + UUID.randomUUID() + "/refund")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":1000,\"reason\":\"x\"}"))
                .andExpect(status().isUnauthorized());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private record TestVariant(String productId, String variantId) {}

    private CustomerEntity createCreditCustomer(BigDecimal creditLimit) {
        CustomerEntity c = new CustomerEntity();
        c.setEmail("credit-pos-" + UUID.randomUUID() + "@bigbike.test");
        c.setPhone("090" + (int)(Math.random() * 10000000));
        c.setDisplayName("Credit POS Customer");
        c.setStatus("ACTIVE");
        c.setSynthetic(false);
        c.setCreditEnabled(true);
        c.setCreditLimit(creditLimit);
        c.setPaymentTermsDays(30);
        c.setCreditStatus("ACTIVE");
        c.setCreatedAt(Instant.now());
        c.setUpdatedAt(Instant.now());
        return customerRepo.save(c);
    }

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

    private void ensureShopManagerUser() {
        adminUserRepo.findByEmail(SHOP_MGR_EMAIL).orElseGet(() -> {
            AdminUserEntity mgr = new AdminUserEntity();
            mgr.setEmail(SHOP_MGR_EMAIL);
            mgr.setPasswordHash(passwordService.hash(SHOP_MGR_PASS));
            mgr.setDisplayName("Phase1M POS ShopManager");
            mgr.setRole("SHOP_MANAGER");
            mgr.setStatus("ACTIVE");
            Instant now = Instant.now();
            mgr.setCreatedAt(now);
            mgr.setUpdatedAt(now);
            return adminUserRepo.save(mgr);
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

    private String loginShopManager() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + SHOP_MGR_EMAIL + "\",\"password\":\"" + SHOP_MGR_PASS + "\"}"))
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

    // ── Phase 4 — pos.refund permission gate ────────────────────────────────────

    @Test
    void posRefund_withoutPosRefundPermission_returns403() throws Exception {
        // SHOP_MANAGER does not have pos.refund — refund endpoint must return 403
        TestVariant tv = createProductWithVariant(10, 100000);
        String shopMgrToken = loginShopManager();

        MvcResult createRes = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(posOrderBodyWithQty("CASH", tv.productId, tv.variantId, 1,
                                UUID.randomUUID().toString())))
                .andExpect(status().isOk())
                .andReturn();
        String orderId = extractJsonString(createRes.getResponse().getContentAsString(), "orderId");

        mockMvc.perform(post("/api/v1/admin/pos/orders/" + orderId + "/refund")
                        .header("Authorization", "Bearer " + shopMgrToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":100000,\"reason\":\"test\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void posRefund_withPosRefundPermission_returns200() throws Exception {
        // ADMIN has pos.refund — refund endpoint must succeed
        TestVariant tv = createProductWithVariant(10, 100000);

        MvcResult createRes = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(posOrderBodyWithQty("CASH", tv.productId, tv.variantId, 1,
                                UUID.randomUUID().toString())))
                .andExpect(status().isOk())
                .andReturn();
        String orderId = extractJsonString(createRes.getResponse().getContentAsString(), "orderId");

        mockMvc.perform(post("/api/v1/admin/pos/orders/" + orderId + "/refund")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":100000,\"reason\":\"test\"}"))
                .andExpect(status().isOk());
    }

    // ── Phase 1 — P0: serial-tracked refund restores serial + voids warranty ──

    @Test
    void posRefund_fullRefundSerialTrackedOrder_restoresSerialAndVoidsWarranty() throws Exception {
        TestSerial ts = createSerialTrackedProductWithSerial();

        // Before sale: serial must be IN_STOCK
        assertThat(serialRepo.findById(ts.serialId()).orElseThrow().getStatus())
                .isEqualTo(ProductSerialStatus.IN_STOCK);

        // Create POS order — reserve + mark sold happen inside
        MvcResult createRes = mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(posOrderBodyWithQty("CASH", ts.productId(), ts.variantId(), 1,
                                UUID.randomUUID().toString())))
                .andExpect(status().isOk())
                .andReturn();
        String orderId = extractJsonString(createRes.getResponse().getContentAsString(), "orderId");

        // After sale: serial must be SOLD and warranty must be ACTIVE
        assertThat(serialRepo.findById(ts.serialId()).orElseThrow().getStatus())
                .isEqualTo(ProductSerialStatus.SOLD);
        assertThat(warrantyRepo.findBySerialId(ts.serialId())).isPresent();
        assertThat(warrantyRepo.findBySerialId(ts.serialId()).orElseThrow().getStatus())
                .isEqualTo("ACTIVE");

        // Full refund: 300000 × 1 = 300000
        mockMvc.perform(post("/api/v1/admin/pos/orders/" + orderId + "/refund")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":300000,\"reason\":\"Khách trả hàng tại quầy\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REFUND_APPLIED"));

        // Serial must be restored to IN_STOCK
        assertThat(serialRepo.findById(ts.serialId()).orElseThrow().getStatus())
                .isEqualTo(ProductSerialStatus.IN_STOCK);

        // Warranty must be VOIDED
        assertThat(warrantyRepo.findBySerialId(ts.serialId()).orElseThrow().getStatus())
                .isEqualTo("VOIDED");

        // Stock movement for serial refund must be written
        assertThat(stockMovementRepo.existsByReferenceTypeAndReferenceId(
                "ORDER_REFUND_SERIAL", UUID.fromString(orderId))).isTrue();

        // Order must be fully REFUNDED
        var order = orderRepo.findById(UUID.fromString(orderId)).orElseThrow();
        assertThat(order.getStatus()).isEqualTo("REFUNDED");
        assertThat(order.getPaymentStatus()).isEqualTo("REFUNDED");
    }

    private record TestSerial(String productId, String variantId, UUID serialId) {}

    private TestSerial createSerialTrackedProductWithSerial() {
        Instant now = Instant.now();
        String catId = "cat-ser-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity cat = new CategoryEntity();
        cat.setId(catId);
        cat.setSlug("ser-cat-" + catId);
        cat.setName("Serial Test Cat");
        cat.setVisible(true);
        cat.setCreatedAt(now);
        cat.setUpdatedAt(now);
        categoryRepo.save(cat);

        String productId = UUID.randomUUID().toString();
        ProductEntity product = new ProductEntity();
        product.setId(productId);
        product.setSlug("ser-" + productId.replace("-", "").substring(0, 12));
        product.setName("Serial Product " + productId.substring(0, 8));
        product.setRetailPrice(BigDecimal.valueOf(300000));
        product.setCurrency("VND");
        product.setPublishStatus(PublishStatus.PUBLISHED);
        product.setStockState(ProductStockState.IN_STOCK);
        product.setCreatedAt(now);
        product.setUpdatedAt(now);
        product.setCategory(cat);
        ProductEntity savedProduct = productRepo.save(product);

        String variantId = UUID.randomUUID().toString();
        ProductVariantEntity variant = new ProductVariantEntity();
        variant.setId(variantId);
        variant.setProduct(savedProduct);
        variant.setName("Default");
        variant.setSku("SER-" + variantId.replace("-", "").substring(0, 8));
        variant.setRetailPrice(BigDecimal.valueOf(300000));
        variant.setCurrency("VND");
        variant.setStockState(ProductStockState.IN_STOCK);
        variant.setQuantityOnHand(0); // serial-tracked: qty managed by DB trigger, not directly
        variant.setTrackSerials(true);
        variant.setAvailable(true);
        variant.setSortOrder(0);
        ProductVariantEntity savedVariant = variantRepo.save(variant);

        ProductSerialEntity serial = new ProductSerialEntity();
        serial.setProduct(savedProduct);
        serial.setVariant(savedVariant);
        serial.setSerialNumber("SN-" + UUID.randomUUID().toString().substring(0, 12));
        serial.setStatus(ProductSerialStatus.IN_STOCK);
        serial.setReceivedAt(now);
        serial.setCreatedAt(now);
        serial.setUpdatedAt(now);
        ProductSerialEntity savedSerial = serialRepo.save(serial);

        return new TestSerial(productId, variantId, savedSerial.getId());
    }
}
