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
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
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
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired PasswordService passwordService;

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

    // ── 19. Update order status — with note → note is persisted ──────────────

    @Test
    void updateOrderStatus_withNote_noteIsPersisted() throws Exception {
        OrderInfo order = placeGuestOrder(1500000);

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

    // ── Helpers ───────────────────────────────────────────────────────────────

    private OrderInfo placeGuestOrder(int price) throws Exception {
        return placeGuestOrderWith(price, "COD");
    }

    private OrderInfo placeGuestOrderBacs(int price) throws Exception {
        return placeGuestOrderWith(price, "BACS");
    }

    private OrderInfo placeGuestOrderWith(int price, String paymentMethod) throws Exception {
        ProductEntity product = createTestProduct("1H Product " + price, price);
        GuestSession session = newGuestSession();

        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1}")
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

    // ── Value types ───────────────────────────────────────────────────────────

    private record GuestSession(Cookie[] cookies, String csrf) {}
    private record OrderInfo(UUID orderId, String orderNumber) {}
}
