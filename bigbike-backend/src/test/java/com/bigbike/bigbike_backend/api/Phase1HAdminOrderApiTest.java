package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderNoteEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderNoteJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import com.bigbike.bigbike_backend.service.order.OrderAutoCancelService;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class Phase1HAdminOrderApiTest {

    private static final String ADMIN_EMAIL = "1h-admin-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS  = "Admin@1234567890";

    private static final String VALID_BILLING = """
            {"fullName":"Test User","phone":"0909123456","email":"test@example.com",
             "addressLine1":"123 Test St","province":"HCM","country":"VN"}
            """;

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired ProductJpaRepository productRepo;
    @Autowired ProductVariantJpaRepository variantRepo;
    @Autowired StockMovementJpaRepository stockMovementRepo;
    @Autowired AuditLogJpaRepository auditLogRepo;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired PasswordService passwordService;
    @Autowired OrderJpaRepository orderRepo;
    @Autowired OrderNoteJpaRepository orderNoteRepo;
    @Autowired OrderAutoCancelService orderAutoCancelService;

    private MockMvc mockMvc;
    private String adminToken;

    // static category so we don't recreate on every test
    private static String testCategoryId;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();

        ensureAdminUser();
        adminToken = loginAdmin();
        ensureTestCategory();
    }

    // ── 1. List orders — no auth → 401 ───────────────────────────────────────

    @Test
    void listOrders_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/orders"))
                .andExpect(status().isUnauthorized());
    }

    // ── 2. List orders — authenticated admin → 200 ────────────────────────────

    @Test
    void listOrders_withAdminToken_returns200() throws Exception {
        placeGuestOrder(1000000);

        mockMvc.perform(get("/api/v1/admin/orders")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.pagination.page").value(1))
                .andExpect(jsonPath("$.pagination.pageSize").exists());
    }

    // ── 3. List orders — includes customerEmail and customerPhone ──────────────

    @Test
    void listOrders_includesCustomerFields() throws Exception {
        placeGuestOrder(2000000);

        MvcResult result = mockMvc.perform(get("/api/v1/admin/orders")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).containsAnyOf("customerEmail", "customerPhone", "itemCount");
    }

    // ── 4. List orders — filter by status ─────────────────────────────────────

    @Test
    void listOrders_filterByStatus_returnsMatchingOrders() throws Exception {
        placeGuestOrder(3000000);

        // PROCESSING orders should be returned
        mockMvc.perform(get("/api/v1/admin/orders")
                        .param("status", "PROCESSING")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());

        // SHIPPED orders should return empty (none created)
        mockMvc.perform(get("/api/v1/admin/orders")
                        .param("status", "SHIPPED")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    // ── 5. List orders — filter by paymentStatus ──────────────────────────────

    @Test
    void listOrders_filterByPaymentStatus_returnsMatchingOrders() throws Exception {
        placeGuestOrder(4000000);

        // UNPAID (COD orders start as UNPAID)
        MvcResult result = mockMvc.perform(get("/api/v1/admin/orders")
                        .param("paymentStatus", "UNPAID")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(result.getResponse().getContentAsString()).contains("UNPAID");
    }

    // ── 6. List orders — search by q ──────────────────────────────────────────

    @Test
    void listOrders_searchByQ_filtersResults() throws Exception {
        OrderInfo order = placeGuestOrder(5000000);

        // Search by partial order number
        String prefix = order.orderNumber.substring(0, 8);
        mockMvc.perform(get("/api/v1/admin/orders")
                        .param("q", prefix)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());

        // Search for something random that won't match
        mockMvc.perform(get("/api/v1/admin/orders")
                        .param("q", "NOMATCH-" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    // ── 7. List orders — pagination ───────────────────────────────────────────

    @Test
    void listOrders_paginationWorks() throws Exception {
        placeGuestOrder(1500000);
        placeGuestOrder(2500000);

        mockMvc.perform(get("/api/v1/admin/orders")
                        .param("page", "1").param("size", "1")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.pagination.pageSize").value(1));
    }

    // ── 8. Get order detail — no auth → 401 ───────────────────────────────────

    @Test
    void getOrderDetail_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/orders/" + UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
    }

    // ── 9. Get order detail — not found → 404 ─────────────────────────────────

    @Test
    void getOrderDetail_unknownId_returns404() throws Exception {
        mockMvc.perform(get("/api/v1/admin/orders/" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
    }

    // ── 10. Get order detail — success with lineItems ─────────────────────────

    @Test
    void getOrderDetail_success_includesLineItems() throws Exception {
        OrderInfo order = placeGuestOrder(6000000);

        mockMvc.perform(get("/api/v1/admin/orders/" + order.orderId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.orderNumber").value(order.orderNumber))
                .andExpect(jsonPath("$.data.lineItems").isArray())
                .andExpect(jsonPath("$.data.lineItems.length()").value(1))
                .andExpect(jsonPath("$.data.addresses").isArray())
                .andExpect(jsonPath("$.data.shippingItems").isArray())
                .andExpect(jsonPath("$.data.payments").isArray());
    }

    // ── 11. Admin sees ALL notes including internal ───────────────────────────

    @Test
    void getOrderDetail_adminSeesAllNotes_includingInternal() throws Exception {
        OrderInfo order = placeGuestOrder(7000000);

        // Add an internal note (customerVisible=false)
        mockMvc.perform(post("/api/v1/admin/orders/" + order.orderId + "/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Internal admin note\",\"customerVisible\":false}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // Admin detail must include that internal note
        mockMvc.perform(get("/api/v1/admin/orders/" + order.orderId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.notes").isArray());

        MvcResult result = mockMvc.perform(get("/api/v1/admin/orders/" + order.orderId)
                        .header("Authorization", "Bearer " + adminToken))
                .andReturn();
        assertThat(result.getResponse().getContentAsString()).contains("Internal admin note");
    }

    // ── 12. Update order status — no auth → 401 ───────────────────────────────

    @Test
    void updateOrderStatus_noAuth_returns401() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/orders/" + UUID.randomUUID() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PROCESSING\"}"))
                .andExpect(status().isUnauthorized());
    }

    // ── 13. Update order status — invalid status string → 400 ────────────────

    @Test
    void updateOrderStatus_invalidStatus_returns400() throws Exception {
        OrderInfo order = placeGuestOrder(8000000);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"BOGUS_STATUS\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // ── 14. Update order status — invalid transition → 409 ───────────────────

    @Test
    void updateOrderStatus_invalidTransition_returns409() throws Exception {
        // CANCELLED → PROCESSING is forbidden
        OrderInfo order = placeGuestOrder(9000000);

        // First transition to CANCELLED
        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // Now try to go CANCELLED → PROCESSING (forbidden)
        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PROCESSING\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());
    }

    // ── 15. Update order status — idempotent same status → 200 ───────────────

    @Test
    void updateOrderStatus_sameStatus_idempotentReturns200() throws Exception {
        OrderInfo order = placeGuestOrder(1100000);

        // COD → PROCESSING, so status is already PROCESSING
        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PROCESSING\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PROCESSING"));
    }

    // ── 16. Update order status — PENDING→PROCESSING → succeeds ──────────────

    @Test
    void updateOrderStatus_pendingToProcessing_succeeds() throws Exception {
        // BACS checkout → ON_HOLD status
        OrderInfo order = placeGuestOrderBacs(1200000);

        // ON_HOLD → PROCESSING
        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PROCESSING\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PROCESSING"));
    }

    // ── 17. Update order status — PROCESSING→COMPLETED sets completedAt ───────

    @Test
    void updateOrderStatus_toCompleted_setsCompletedAt() throws Exception {
        OrderInfo order = placeGuestOrder(1300000);
        // Backend now requires DELIVERED + PAID before a COD delivery order can be COMPLETED.
        markPaid(order.orderId, 1300000);
        markDelivered(order.orderId);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.completedAt").isNotEmpty());
    }

    // ── 18. Update order status — PROCESSING→CANCELLED sets cancelledAt ───────

    @Test
    void updateOrderStatus_toCancelled_setsCancelledAt() throws Exception {
        OrderInfo order = placeGuestOrder(1400000);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"))
                .andExpect(jsonPath("$.data.cancelledAt").isNotEmpty());
    }

    @Test
    void cancelOrder_restoresProductLevelStock() throws Exception {
        ProductEntity product = createManagedStockProduct("1H Managed Product", 2100000, 10);
        OrderInfo order = placeGuestOrderForItem(product.getId(), null, 2, "COD");

        ProductEntity afterCheckout = productRepo.findById(product.getId()).orElseThrow();
        assertThat(afterCheckout.getStockQuantity()).isEqualTo(8);
        assertThat(afterCheckout.getStockState()).isEqualTo(ProductStockState.IN_STOCK);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));

        ProductEntity restored = productRepo.findById(product.getId()).orElseThrow();
        assertThat(restored.getStockQuantity()).isEqualTo(10);
        assertThat(restored.getStockState()).isEqualTo(ProductStockState.IN_STOCK);
    }

    @Test
    void cancelOrder_writesOrderCancelStockMovement() throws Exception {
        VariantFixture fixture = createProductWithVariantStock(4, 1900000);
        OrderInfo order = placeGuestOrderForItem(fixture.productId(), fixture.variantId(), 2, "COD");

        ProductVariantEntity afterCheckout = variantRepo.findById(fixture.variantId()).orElseThrow();
        assertThat(afterCheckout.getQuantityOnHand()).isEqualTo(2);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));

        ProductVariantEntity restored = variantRepo.findById(fixture.variantId()).orElseThrow();
        assertThat(restored.getQuantityOnHand()).isEqualTo(4);

        List<StockMovementEntity> movements = stockMovementRepo.findByVariantIdOrderByCreatedAtDesc(
                fixture.variantId(), PageRequest.of(0, 10));
        StockMovementEntity cancelMovement = movements.stream()
                .filter(m -> "ORDER_CANCEL".equals(m.getReferenceType()) && order.orderId.equals(m.getReferenceId()))
                .findFirst()
                .orElseThrow();
        assertThat(cancelMovement.getMovementType()).isEqualTo("IN");
        assertThat(cancelMovement.getQuantityDelta()).isEqualTo(2);
        assertThat(cancelMovement.getQuantityBefore()).isEqualTo(2);
        assertThat(cancelMovement.getQuantityAfter()).isEqualTo(4);
    }

    // ── 19. Update order status — with note → note is persisted ──────────────

    @Test
    void updateOrderStatus_withNote_noteIsPersisted() throws Exception {
        OrderInfo order = placeGuestOrder(1500000);
        markPaid(order.orderId, 1500000);
        markDelivered(order.orderId);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\",\"note\":\"Delivered by courier\",\"customerVisible\":true}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // Verify note in notes list
        MvcResult notesResult = mockMvc.perform(get("/api/v1/admin/orders/" + order.orderId + "/notes")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(notesResult.getResponse().getContentAsString()).contains("Delivered by courier");
    }

    // ── 20. Update payment status — no auth → 401 ─────────────────────────────

    @Test
    void updatePaymentStatus_noAuth_returns401() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/orders/" + UUID.randomUUID() + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PAID\"}"))
                .andExpect(status().isUnauthorized());
    }

    // ── 21. Update payment status — PAID → sets paidAmount + paidAt ──────────

    @Test
    void updatePaymentStatus_paid_setsPaidAmountAndPaidAt() throws Exception {
        OrderInfo order = placeGuestOrder(2000000);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PAID\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentStatus").value("PAID"))
                .andExpect(jsonPath("$.data.paidAmount").isNumber())
                .andExpect(jsonPath("$.data.paidAt").isNotEmpty());
    }

    // ── 22. Update payment status — PARTIALLY_PAID requires valid paidAmount ──

    @Test
    void updatePaymentStatus_partiallyPaid_invalidAmount_returns400() throws Exception {
        OrderInfo order = placeGuestOrder(3000000);

        // paidAmount = 0 → invalid
        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PARTIALLY_PAID\",\"paidAmount\":0}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());

        // paidAmount >= totalAmount → invalid (totalAmount for a 3000000 VND product + shipping)
        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PARTIALLY_PAID\",\"paidAmount\":9999999}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());

        // Valid partial amount
        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PARTIALLY_PAID\",\"paidAmount\":500000}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentStatus").value("PARTIALLY_PAID"))
                .andExpect(jsonPath("$.data.paidAmount").value(500000.00));
    }

    // ── 23. Update payment status — UNPAID clears paidAt ─────────────────────

    @Test
    void updatePaymentStatus_unpaid_clearsPaidAt() throws Exception {
        OrderInfo order = placeGuestOrder(4000000);

        // First mark as PAID
        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PAID\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // Then revert to UNPAID (paidAmount must be 0)
        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"UNPAID\",\"paidAmount\":0}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentStatus").value("UNPAID"))
                .andExpect(jsonPath("$.data.paidAt").isEmpty());
    }

    // ── 24. Update payment status — invalid status string → 400 ───────────────

    @Test
    void updatePaymentStatus_invalidStatus_returns400() throws Exception {
        OrderInfo order = placeGuestOrder(5000000);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"BOGUS_PAYMENT\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // ── 25. Add note — no auth → 401 ──────────────────────────────────────────

    @Test
    void addNote_noAuth_returns401() throws Exception {
        mockMvc.perform(post("/api/v1/admin/orders/" + UUID.randomUUID() + "/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Note content\"}"))
                .andExpect(status().isUnauthorized());
    }

    // ── 26. Add internal note — content + customerVisible=false ───────────────

    @Test
    void addNote_internalNote_savedWithCustomerVisibleFalse() throws Exception {
        OrderInfo order = placeGuestOrder(6000000);

        MvcResult result = mockMvc.perform(post("/api/v1/admin/orders/" + order.orderId + "/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Internal note\",\"customerVisible\":false,\"noteType\":\"INTERNAL\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").value("Internal note"))
                .andExpect(jsonPath("$.data.customerVisible").value(false))
                .andReturn();

        assertThat(result.getResponse().getContentAsString()).contains("INTERNAL");
    }

    // ── 27. Add customer-visible note — shows in notes list ───────────────────

    @Test
    void addNote_customerVisibleNote_appearsInNotesList() throws Exception {
        OrderInfo order = placeGuestOrder(7000000);

        mockMvc.perform(post("/api/v1/admin/orders/" + order.orderId + "/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Customer-facing note\",\"customerVisible\":true}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.customerVisible").value(true));

        // List notes — must include the note
        MvcResult notesResult = mockMvc.perform(get("/api/v1/admin/orders/" + order.orderId + "/notes")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(notesResult.getResponse().getContentAsString()).contains("Customer-facing note");
    }

    // ── 28. Regression — existing APIs still work ─────────────────────────────

    @Test
    void createRefund_unpaidOrder_returns409() throws Exception {
        OrderInfo order = placeGuestOrder(7100000);

        mockMvc.perform(post("/api/v1/admin/orders/" + order.orderId + "/refund")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":100000,\"refundReason\":\"CUSTOMER_REQUEST\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());
    }

    @Test
    void createRefund_partial_setsPartiallyRefunded() throws Exception {
        OrderInfo order = placeGuestOrder(7200000);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PAID\",\"paidAmount\":2000000}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/orders/" + order.orderId + "/refund")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"refundAmount":500000,"refundReason":"CUSTOMER_REQUEST",
                                 "note":"Refund 500k","customerVisible":true}
                                """)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentStatus").value("PARTIALLY_REFUNDED"))
                .andExpect(jsonPath("$.data.status").value("PROCESSING"))
                .andExpect(jsonPath("$.data.refundAmount").value(500000.00))
                .andExpect(jsonPath("$.data.refundReason").value("CUSTOMER_REQUEST"))
                .andExpect(jsonPath("$.data.refundedAt").isNotEmpty());
    }

    @Test
    void createRefund_full_setsRefundedStatus_andSyncsPaymentRecord() throws Exception {
        OrderInfo order = placeGuestOrder(7300000);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PAID\",\"paidAmount\":1200000}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        markDelivered(order.orderId);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));

        mockMvc.perform(post("/api/v1/admin/orders/" + order.orderId + "/refund")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"refundAmount":1200000,"refundReason":"CUSTOMER_REQUEST",
                                 "note":"Full refund","customerVisible":true}
                                """)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REFUNDED"))
                .andExpect(jsonPath("$.data.paymentStatus").value("REFUNDED"))
                .andExpect(jsonPath("$.data.refundAmount").value(1200000.00))
                .andExpect(jsonPath("$.data.refundedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.payments[0].status").value("REFUNDED"))
                .andExpect(jsonPath("$.data.payments[0].paymentMethod").value("COD"));
    }

    @Test
    void createRefund_exceedsRefundable_returns400() throws Exception {
        OrderInfo order = placeGuestOrder(7400000);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PAID\",\"paidAmount\":900000}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/orders/" + order.orderId + "/refund")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":900001,\"refundReason\":\"CUSTOMER_REQUEST\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listAllowedTransitions_returnsSortedCurrentOptions() throws Exception {
        OrderInfo order = placeGuestOrder(7450000);

        mockMvc.perform(get("/api/v1/admin/orders/" + order.orderId + "/allowed-transitions")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(3))
                .andExpect(jsonPath("$.data[0]").value("CANCELLED"))
                .andExpect(jsonPath("$.data[1]").value("COMPLETED"))
                .andExpect(jsonPath("$.data[2]").value("FAILED"));
    }

    // ── Direct PATCH status COMPLETED → REFUNDED must be rejected.
    //    Refund integrity (refund_transaction, payment.refundAmount, warranty void,
    //    SOLD serial restore, receivable write-off) belongs to RefundService;
    //    the dedicated POST /refund endpoint is the only legitimate path.
    @Test
    void updateOrderStatus_completedToRefunded_isRejected() throws Exception {
        OrderInfo order = placeGuestOrder(7460000);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PAID\",\"paidAmount\":7460000}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        markDelivered(order.orderId);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"REFUNDED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());

        mockMvc.perform(get("/api/v1/admin/orders/" + order.orderId + "/allowed-transitions")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    void refundReport_partial_includesPartialRefundAmount() throws Exception {
        Instant from = Instant.now().minusSeconds(1);
        BigDecimal refundBefore = fetchRefundAmountSummary(from, Instant.now().plusSeconds(1));

        OrderInfo partialRefundOrder = placeGuestOrder(7500000);
        mockMvc.perform(patch("/api/v1/admin/orders/" + partialRefundOrder.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PAID\",\"paidAmount\":900000}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/admin/orders/" + partialRefundOrder.orderId + "/refund")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":300000,\"refundReason\":\"CUSTOMER_REQUEST\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        OrderInfo fullRefundOrder = placeGuestOrder(7600000);
        mockMvc.perform(patch("/api/v1/admin/orders/" + fullRefundOrder.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PAID\",\"paidAmount\":1200000}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
        markDelivered(fullRefundOrder.orderId);
        mockMvc.perform(patch("/api/v1/admin/orders/" + fullRefundOrder.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/admin/orders/" + fullRefundOrder.orderId + "/refund")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":1200000,\"refundReason\":\"CUSTOMER_REQUEST\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        Instant to = Instant.now().plusSeconds(1);
        BigDecimal refundAfter = fetchRefundAmountSummary(from, to);
        assertThat(refundAfter.subtract(refundBefore)).isEqualByComparingTo(BigDecimal.valueOf(1500000));
    }

    @Test
    void regression_existingApisStillWork() throws Exception {
        // Public catalog still accessible
        mockMvc.perform(get("/api/v1/products").param("page", "1").param("size", "2"))
                .andExpect(status().isOk());

        // Cart still accessible without auth
        mockMvc.perform(get("/api/v1/cart"))
                .andExpect(status().isOk());

        // Customer orders still protected
        mockMvc.perform(get("/api/v1/customer/orders"))
                .andExpect(status().isUnauthorized());

        // Checkout options still public
        mockMvc.perform(get("/api/v1/checkout/options"))
                .andExpect(status().isOk());

        // Admin endpoints require auth (not just any auth — must be ROLE_ADMIN)
        mockMvc.perform(get("/api/v1/admin/orders"))
                .andExpect(status().isUnauthorized());
    }

    // ── ORD-005: Full refund of COMPLETED variant order restores stock ─────────

    @Test
    void fullRefundCompletedVariantOrder_restoresStockAndWritesOrderRefundMovement() throws Exception {
        VariantFixture fixture = createProductWithVariantStock(5, 2000000);
        OrderInfo order = placeGuestOrderForItem(fixture.productId(), fixture.variantId(), 2, "COD");

        ProductVariantEntity afterCheckout = variantRepo.findById(fixture.variantId()).orElseThrow();
        assertThat(afterCheckout.getQuantityOnHand()).isEqualTo(3);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PAID\",\"paidAmount\":4000000}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        markDelivered(order.orderId);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/orders/" + order.orderId + "/refund")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":4000000,\"refundReason\":\"CUSTOMER_REQUEST\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REFUNDED"));

        ProductVariantEntity restored = variantRepo.findById(fixture.variantId()).orElseThrow();
        assertThat(restored.getQuantityOnHand()).isEqualTo(5);

        List<StockMovementEntity> movements = stockMovementRepo
                .findByReferenceTypeAndReferenceId("ORDER_REFUND", order.orderId);
        assertThat(movements).hasSize(1);
        StockMovementEntity m = movements.get(0);
        assertThat(m.getMovementType()).isEqualTo("IN");
        assertThat(m.getQuantityDelta()).isEqualTo(2);
        assertThat(m.getQuantityBefore()).isEqualTo(3);
        assertThat(m.getQuantityAfter()).isEqualTo(5);
    }

    // ── ORD-002: Cancel product-level order writes ORDER_CANCEL movement ───────

    @Test
    void cancelProductLevelOrder_writesOrderCancelStockMovement() throws Exception {
        ProductEntity product = createManagedStockProduct("1H ORD-002 Product", 1500000, 8);
        OrderInfo order = placeGuestOrderForItem(product.getId(), null, 3, "COD");

        ProductEntity afterCheckout = productRepo.findById(product.getId()).orElseThrow();
        assertThat(afterCheckout.getStockQuantity()).isEqualTo(5);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));

        ProductEntity restored = productRepo.findById(product.getId()).orElseThrow();
        assertThat(restored.getStockQuantity()).isEqualTo(8);

        List<StockMovementEntity> movements = stockMovementRepo
                .findByReferenceTypeAndReferenceId("ORDER_CANCEL", order.orderId);
        assertThat(movements).hasSize(1);
        StockMovementEntity m = movements.get(0);
        assertThat(m.getMovementType()).isEqualTo("IN");
        assertThat(m.getQuantityDelta()).isEqualTo(3);
        assertThat(m.getQuantityBefore()).isEqualTo(5);
        assertThat(m.getQuantityAfter()).isEqualTo(8);
        assertThat(m.getProductId()).isEqualTo(product.getId());
        assertThat(m.getVariant()).isNull();
    }

    // ── ORD-002: Full refund of COMPLETED product-level order restores stock ───

    @Test
    void fullRefundCompletedProductLevelOrder_restoresStockAndWritesOrderRefundMovement() throws Exception {
        ProductEntity product = createManagedStockProduct("1H ORD-002 Refund Product", 2500000, 10);
        OrderInfo order = placeGuestOrderForItem(product.getId(), null, 4, "COD");

        ProductEntity afterCheckout = productRepo.findById(product.getId()).orElseThrow();
        assertThat(afterCheckout.getStockQuantity()).isEqualTo(6);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PAID\",\"paidAmount\":10000000}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        markDelivered(order.orderId);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/orders/" + order.orderId + "/refund")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":10000000,\"refundReason\":\"CUSTOMER_REQUEST\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REFUNDED"));

        ProductEntity restored = productRepo.findById(product.getId()).orElseThrow();
        assertThat(restored.getStockQuantity()).isEqualTo(10);

        List<StockMovementEntity> movements = stockMovementRepo
                .findByReferenceTypeAndReferenceId("ORDER_REFUND", order.orderId);
        assertThat(movements).hasSize(1);
        StockMovementEntity m = movements.get(0);
        assertThat(m.getMovementType()).isEqualTo("IN");
        assertThat(m.getQuantityDelta()).isEqualTo(4);
        assertThat(m.getProductId()).isEqualTo(product.getId());
        assertThat(m.getVariant()).isNull();
    }

    // ── Partial refund does NOT restore stock ─────────────────────────────────

    @Test
    void partialRefund_doesNotRestoreStock() throws Exception {
        VariantFixture fixture = createProductWithVariantStock(6, 3000000);
        OrderInfo order = placeGuestOrderForItem(fixture.productId(), fixture.variantId(), 2, "COD");

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PAID\",\"paidAmount\":6000000}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        markDelivered(order.orderId);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/orders/" + order.orderId + "/refund")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":3000000,\"refundReason\":\"CUSTOMER_REQUEST\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentStatus").value("PARTIALLY_REFUNDED"));

        // Stock must NOT be restored for a partial refund
        ProductVariantEntity notRestored = variantRepo.findById(fixture.variantId()).orElseThrow();
        assertThat(notRestored.getQuantityOnHand()).isEqualTo(4);

        assertThat(stockMovementRepo
                .findByReferenceTypeAndReferenceId("ORDER_REFUND", order.orderId)).isEmpty();
    }

    // ── ORD-005 idempotency: double call does not double-restore stock ─────────

    @Test
    void fullRefund_idempotencyGuard_doesNotDoubleRestore() throws Exception {
        VariantFixture fixture = createProductWithVariantStock(8, 1000000);
        OrderInfo order = placeGuestOrderForItem(fixture.productId(), fixture.variantId(), 2, "COD");

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PAID\",\"paidAmount\":2000000}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        markDelivered(order.orderId);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // First full refund — restores stock
        mockMvc.perform(post("/api/v1/admin/orders/" + order.orderId + "/refund")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":2000000,\"refundReason\":\"CUSTOMER_REQUEST\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REFUNDED"));

        ProductVariantEntity afterRefund = variantRepo.findById(fixture.variantId()).orElseThrow();
        assertThat(afterRefund.getQuantityOnHand()).isEqualTo(8);

        // Second refund attempt on already-REFUNDED order — must be rejected (payment already REFUNDED)
        mockMvc.perform(post("/api/v1/admin/orders/" + order.orderId + "/refund")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":2000000,\"refundReason\":\"RETRY\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());

        // Quantity must remain at original (no double-restore)
        ProductVariantEntity afterRetry = variantRepo.findById(fixture.variantId()).orElseThrow();
        assertThat(afterRetry.getQuantityOnHand()).isEqualTo(8);

        // Only one ORDER_REFUND movement written
        assertThat(stockMovementRepo
                .findByReferenceTypeAndReferenceId("ORDER_REFUND", order.orderId)).hasSize(1);
    }

    // ── ORD-001: Audit logs include IP and User-Agent ─────────────────────────

    @Test
    void updateOrderStatus_writesAuditLogWithIpAndUserAgent() throws Exception {
        // COD orders start in PROCESSING; backend now requires PAID + DELIVERED
        // before allowing the PROCESSING → COMPLETED transition.
        OrderInfo order = placeGuestOrder(8100000);
        markPaid(order.orderId, 8100000);
        markDelivered(order.orderId);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}")
                        .header("Authorization", "Bearer " + adminToken)
                        .header("User-Agent", "TestBrowser/1.0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));

        AuditLogEntity log = auditLogRepo.findAll().stream()
                .filter(a -> order.orderId.equals(a.getResourceId())
                        && "ORDER_STATUS_UPDATED".equals(a.getAction()))
                .findFirst().orElseThrow();
        assertThat(log.getIpAddress()).isNotBlank();
        assertThat(log.getUserAgent()).isEqualTo("TestBrowser/1.0");
    }

    @Test
    void updatePaymentStatus_writesAuditLogWithIpAndUserAgent() throws Exception {
        OrderInfo order = placeGuestOrder(8200000);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PAID\",\"paidAmount\":8200000}")
                        .header("Authorization", "Bearer " + adminToken)
                        .header("User-Agent", "TestBrowser/2.0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentStatus").value("PAID"));

        AuditLogEntity log = auditLogRepo.findAll().stream()
                .filter(a -> order.orderId.equals(a.getResourceId())
                        && "ORDER_PAYMENT_STATUS_UPDATED".equals(a.getAction()))
                .findFirst().orElseThrow();
        assertThat(log.getIpAddress()).isNotBlank();
        assertThat(log.getUserAgent()).isEqualTo("TestBrowser/2.0");
    }

    @Test
    void createRefund_writesAuditLogWithIpAndUserAgent() throws Exception {
        OrderInfo order = placeGuestOrder(8300000);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PAID\",\"paidAmount\":8300000}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/orders/" + order.orderId + "/refund")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refundAmount\":1000000,\"refundReason\":\"CUSTOMER_REQUEST\"}")
                        .header("Authorization", "Bearer " + adminToken)
                        .header("User-Agent", "TestBrowser/3.0"))
                .andExpect(status().isOk());

        AuditLogEntity log = auditLogRepo.findAll().stream()
                .filter(a -> order.orderId.equals(a.getResourceId())
                        && "ORDER_REFUND_CREATED".equals(a.getAction()))
                .findFirst().orElseThrow();
        assertThat(log.getIpAddress()).isNotBlank();
        assertThat(log.getUserAgent()).isEqualTo("TestBrowser/3.0");
    }

    @Test
    void addNote_writesAuditLogWithIpAndUserAgent() throws Exception {
        OrderInfo order = placeGuestOrder(8400000);

        mockMvc.perform(post("/api/v1/admin/orders/" + order.orderId + "/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Test note\",\"noteType\":\"ADMIN\",\"customerVisible\":false}")
                        .header("Authorization", "Bearer " + adminToken)
                        .header("User-Agent", "TestBrowser/4.0"))
                .andExpect(status().isOk());

        AuditLogEntity log = auditLogRepo.findAll().stream()
                .filter(a -> order.orderId.equals(a.getResourceId())
                        && "ORDER_NOTE_CREATED".equals(a.getAction()))
                .findFirst().orElseThrow();
        assertThat(log.getIpAddress()).isNotBlank();
        assertThat(log.getUserAgent()).isEqualTo("TestBrowser/4.0");
    }

    // ── BACS unpaid auto-cancel — Issue 5 ─────────────────────────────────────
    //
    // OrderAutoCancelService releases stale BACS reservations. Service-level
    // assertion is used because the scheduler runs hourly via cron and would
    // not fire reliably during a test.

    @Test
    void autoCancelExpiredBacs_olderThanCutoff_cancelsAndAddsSystemNote() throws Exception {
        OrderInfo bacs = placeGuestOrderBacs(2400000);

        OrderEntity order = orderRepo.findById(bacs.orderId).orElseThrow();
        // Default cutoff is 72h; backdate placedAt by 100h so it is comfortably past.
        order.setPlacedAt(Instant.now().minus(java.time.Duration.ofHours(100)));
        order.setUpdatedAt(Instant.now());
        orderRepo.save(order);

        int cancelled = orderAutoCancelService.autoCancelExpiredBacsUnpaidOrders();
        assertThat(cancelled).isGreaterThanOrEqualTo(1);

        OrderEntity reloaded = orderRepo.findById(bacs.orderId).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo("CANCELLED");
        assertThat(reloaded.getCancelledAt()).isNotNull();

        // System note is logged for audit trail.
        assertThat(orderNoteRepo.findByOrderId(bacs.orderId))
                .anySatisfy(n -> {
                    assertThat(n.getAuthorType()).isEqualTo("SYSTEM");
                    assertThat(n.getContent()).contains("tự động huỷ");
                });
    }

    @Test
    void autoCancelExpiredBacs_recentOrder_isNotCancelled() throws Exception {
        OrderInfo bacs = placeGuestOrderBacs(2500000);
        // Fresh order — placedAt = now, well within the cutoff.

        orderAutoCancelService.autoCancelExpiredBacsUnpaidOrders();

        OrderEntity reloaded = orderRepo.findById(bacs.orderId).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo("ON_HOLD");
    }

    @Test
    void autoCancelExpiredBacs_codOrder_isNotCancelled() throws Exception {
        OrderInfo cod = placeGuestOrder(2600000);

        OrderEntity order = orderRepo.findById(cod.orderId).orElseThrow();
        order.setPlacedAt(Instant.now().minus(java.time.Duration.ofHours(200)));
        order.setUpdatedAt(Instant.now());
        orderRepo.save(order);

        orderAutoCancelService.autoCancelExpiredBacsUnpaidOrders();

        OrderEntity reloaded = orderRepo.findById(cod.orderId).orElseThrow();
        // COD orders are not in scope — paid-on-delivery has its own follow-up workflow.
        assertThat(reloaded.getStatus()).isEqualTo("PROCESSING");
    }

    @Test
    void autoCancelExpiredBacs_paidOrder_isNotCancelled() throws Exception {
        OrderInfo bacs = placeGuestOrderBacs(2700000);

        OrderEntity order = orderRepo.findById(bacs.orderId).orElseThrow();
        order.setPlacedAt(Instant.now().minus(java.time.Duration.ofHours(200)));
        order.setPaymentStatus("PAID");
        order.setPaidAmount(order.getTotalAmount());
        order.setUpdatedAt(Instant.now());
        orderRepo.save(order);

        orderAutoCancelService.autoCancelExpiredBacsUnpaidOrders();

        OrderEntity reloaded = orderRepo.findById(bacs.orderId).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo("ON_HOLD");
        assertThat(reloaded.getPaymentStatus()).isEqualTo("PAID");
    }

    // ── Business rule guards: COMPLETED / CANCELLED preconditions ─────────────

    // Rule 2: COD orders cannot be COMPLETED until cash has been collected.
    @Test
    void completeOrder_codDeliveryUnpaid_isRejected() throws Exception {
        OrderInfo order = placeGuestOrder(1700000);
        // Goods on the doorstep, but the courier hasn't handed cash back yet.
        markDelivered(order.orderId);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());

        OrderEntity reloaded = orderRepo.findById(order.orderId).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo("PROCESSING");
        assertThat(reloaded.getCompletedAt()).isNull();
    }

    // Rule 3: DELIVERY orders cannot be COMPLETED until they are marked DELIVERED.
    @Test
    void completeOrder_codPaidButNotDelivered_isRejected() throws Exception {
        OrderInfo order = placeGuestOrder(1750000);
        markPaid(order.orderId, 1750000);
        // Skip the DELIVERED step intentionally.

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());

        OrderEntity reloaded = orderRepo.findById(order.orderId).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo("PROCESSING");
        assertThat(reloaded.getCompletedAt()).isNull();
    }

    // Rule 2 + 3 happy path: COD + DELIVERED + PAID → COMPLETED succeeds.
    @Test
    void completeOrder_codPaidAndDelivered_succeeds() throws Exception {
        OrderInfo order = placeGuestOrder(1800000);
        markPaid(order.orderId, 1800000);
        markDelivered(order.orderId);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.completedAt").isNotEmpty());
    }

    // Rule 4: PAID orders cannot be CANCELLED directly — must go through refund/void.
    @Test
    void cancelOrder_processingPaid_isRejected_andStockNotRestored() throws Exception {
        VariantFixture fixture = createProductWithVariantStock(4, 1900000);
        OrderInfo order = placeGuestOrderForItem(fixture.productId(), fixture.variantId(), 2, "COD");

        // Stock dropped from 4 to 2 at checkout.
        assertThat(variantRepo.findById(fixture.variantId()).orElseThrow().getQuantityOnHand())
                .isEqualTo(2);

        markPaid(order.orderId, 3800000);

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());

        OrderEntity reloaded = orderRepo.findById(order.orderId).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo("PROCESSING");
        assertThat(reloaded.getCancelledAt()).isNull();

        // Stock must NOT be restored — the guard fires before the side-effect path.
        assertThat(variantRepo.findById(fixture.variantId()).orElseThrow().getQuantityOnHand())
                .isEqualTo(2);
    }

    // Rule 4: PARTIALLY_PAID orders cannot be CANCELLED directly either.
    @Test
    void cancelOrder_processingPartiallyPaid_isRejected() throws Exception {
        OrderInfo order = placeGuestOrder(2200000);

        // Pay only part of the total — total = product + shipping, exact amount irrelevant
        // as long as it is strictly between 0 and total.
        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PARTIALLY_PAID\",\"paidAmount\":500000}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());

        OrderEntity reloaded = orderRepo.findById(order.orderId).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo("PROCESSING");
    }

    // Rule 4 happy path: UNPAID orders cancel cleanly (regression check that the
    // guard only fires for PAID / PARTIALLY_PAID).
    @Test
    void cancelOrder_processingUnpaid_succeeds() throws Exception {
        OrderInfo order = placeGuestOrder(2300000);
        mockMvc.perform(patch("/api/v1/admin/orders/" + order.orderId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Drive the DELIVERY fulfillment state machine to DELIVERED so an admin can
     * legally flip a COD/BACS order to COMPLETED. Backend now enforces the
     * "goods delivered + cash collected" precondition (see
     * AdminOrderService#validateBeforeComplete), so any test that completes a
     * delivery order must walk through this first.
     */
    private void markDelivered(UUID orderId) throws Exception {
        mockMvc.perform(patch("/api/v1/admin/orders/" + orderId + "/fulfillment")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fulfillmentStatus\":\"DELIVERED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    private void markPaid(UUID orderId, long amount) throws Exception {
        mockMvc.perform(patch("/api/v1/admin/orders/" + orderId + "/payment-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PAID\",\"paidAmount\":" + amount + "}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    private OrderInfo placeGuestOrder(int price) throws Exception {
        return placeGuestOrderWith(price, "COD");
    }

    private OrderInfo placeGuestOrderBacs(int price) throws Exception {
        return placeGuestOrderWith(price, "BACS");
    }

    private OrderInfo placeGuestOrderWith(int price, String paymentMethod) throws Exception {
        ProductEntity product = createTestProduct("1H Product " + price, price);
        return placeGuestOrderForItem(product.getId(), null, 1, paymentMethod);
    }

    private OrderInfo placeGuestOrderForItem(
            String productId,
            String productVariantId,
            int quantity,
            String paymentMethod
    ) throws Exception {
        GuestSession session = newGuestSession();

        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(addCartItemPayload(productId, productVariantId, quantity))
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk());

        MvcResult result = mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"" + paymentMethod + "\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        String orderId = extractJsonValue(body, "id");
        String orderNumber = extractJsonValue(body, "orderNumber");
        return new OrderInfo(UUID.fromString(orderId), orderNumber);
    }

    private GuestSession newGuestSession() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = result.getResponse().getCookies();
        String csrf = getCookieValue(result.getResponse(), "bb_csrf");
        return new GuestSession(cookies, csrf);
    }

    private ProductEntity createTestProduct(String name, int price) {
        Instant now = Instant.now();
        ProductEntity p = new ProductEntity();
        p.setId(UUID.randomUUID().toString());
        p.setSlug("1h-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        p.setName(name);
        p.setRetailPrice(java.math.BigDecimal.valueOf(price));
        p.setCurrency("VND");
        p.setPublishStatus(PublishStatus.PUBLISHED);
        p.setStockState(ProductStockState.IN_STOCK);
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        p.setCategory(categoryRepo.findById(testCategoryId).orElseThrow());
        return productRepo.save(p);
    }

    private ProductEntity createManagedStockProduct(String name, int price, int stockQuantity) {
        ProductEntity product = createTestProduct(name, price);
        product.setManageStock(true);
        product.setStockQuantity(stockQuantity);
        product.setForceOutOfStock(false);
        product.setStockState(ProductStockState.IN_STOCK);
        product.setUpdatedAt(Instant.now());
        return productRepo.save(product);
    }

    private VariantFixture createProductWithVariantStock(int stock, int price) {
        Instant now = Instant.now();
        ProductEntity product = createManagedStockProduct("1H Variant Product", price, 0);
        product.setManageStock(false);
        product.setStockState(ProductStockState.IN_STOCK);
        product.setUpdatedAt(now);
        product = productRepo.save(product);

        ProductVariantEntity variant = new ProductVariantEntity();
        variant.setId(UUID.randomUUID().toString());
        variant.setProduct(product);
        variant.setName("Default");
        variant.setSku("1H-VAR-" + variant.getId().replace("-", "").substring(0, 8));
        variant.setRetailPrice(BigDecimal.valueOf(price));
        variant.setCurrency("VND");
        variant.setStockState(ProductStockState.IN_STOCK);
        variant.setQuantityOnHand(stock);
        variant.setAvailable(true);
        variant.setSortOrder(0);
        variantRepo.save(variant);

        return new VariantFixture(product.getId(), variant.getId());
    }

    private String addCartItemPayload(String productId, String productVariantId, int quantity) {
        if (productVariantId == null) {
            return "{\"productId\":\"" + productId + "\",\"quantity\":" + quantity + "}";
        }
        return "{\"productId\":\"" + productId + "\",\"productVariantId\":\"" + productVariantId +
                "\",\"quantity\":" + quantity + "}";
    }

    private void ensureTestCategory() {
        if (testCategoryId != null) return;
        testCategoryId = "cat-1h-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity cat = new CategoryEntity();
        cat.setId(testCategoryId);
        cat.setSlug("admin-order-cat-" + testCategoryId);
        cat.setName("Admin Order Test Category");
        cat.setVisible(true);
        cat.setCreatedAt(Instant.now());
        cat.setUpdatedAt(Instant.now());
        categoryRepo.save(cat);
    }

    private void ensureAdminUser() {
        adminUserRepo.findByEmail(ADMIN_EMAIL).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(ADMIN_EMAIL);
            admin.setPasswordHash(passwordService.hash(ADMIN_PASS));
            admin.setDisplayName("Phase1H Test Admin");
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
        return extractJsonValue(result.getResponse().getContentAsString(), "accessToken");
    }

    private String getCookieValue(MockHttpServletResponse response, String name) {
        Cookie[] cookies = response.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return c.getValue();
        }
        return null;
    }

    private String extractJsonValue(String json, String key) {
        String marker = "\"" + key + "\":\"";
        int start = json.indexOf(marker);
        if (start < 0) return null;
        start += marker.length();
        int end = json.indexOf("\"", start);
        return json.substring(start, end);
    }

    private BigDecimal fetchRefundAmountSummary(Instant from, Instant to) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/admin/reports/analytics")
                        .param("from", from.toString())
                        .param("to", to.toString())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        return extractJsonDecimalValue(result.getResponse().getContentAsString(), "refundAmount");
    }

    private BigDecimal extractJsonDecimalValue(String json, String key) {
        String marker = "\"" + key + "\":";
        int start = json.indexOf(marker);
        if (start < 0) return BigDecimal.ZERO;
        start += marker.length();
        int end = start;
        while (end < json.length()) {
            char c = json.charAt(end);
            if ((c < '0' || c > '9') && c != '.' && c != '-') {
                break;
            }
            end++;
        }
        return new BigDecimal(json.substring(start, end));
    }

    // ── Value types ───────────────────────────────────────────────────────────

    private record GuestSession(Cookie[] cookies, String csrf) {}
    private record OrderInfo(UUID orderId, String orderNumber) {}
    private record VariantFixture(String productId, String variantId) {}
}
