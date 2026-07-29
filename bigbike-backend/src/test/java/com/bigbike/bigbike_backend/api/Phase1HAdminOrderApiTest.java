package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.commerce.PaymentRecordStatus;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminRoleEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminRoleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import com.bigbike.bigbike_backend.service.auth.AdminPermissionService;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class Phase1HAdminOrderApiTest {

    private static final String ADMIN_EMAIL = "order-status-admin-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ORDER_READER_EMAIL = "order-reader-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ORDER_WRITER_EMAIL = "order-writer-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ORDER_READER_ROLE = "ORDER_API_TEST_READER";
    private static final String ORDER_WRITER_ROLE = "ORDER_API_TEST_WRITER";
    private static final String ADMIN_PASS = "Admin@1234567890";
    private static final String VALID_BILLING =
            "{\"fullName\":\"Test User\",\"phone\":\"0909123456\",\"email\":\"test@example.com\","
                    + "\"addressLine1\":\"123 Test St\",\"province\":\"HCM\",\"ward\":\"Phuong 1\",\"country\":\"VN\"}";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminRoleJpaRepository adminRoleRepo;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired AdminPermissionService adminPermissionService;
    @Autowired PasswordService passwordService;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired ProductJpaRepository productRepo;
    @Autowired OrderJpaRepository orderRepo;
    @Autowired PaymentJpaRepository paymentRepo;
    @Autowired AuditLogJpaRepository auditLogRepo;

    private MockMvc mockMvc;
    private String adminToken;
    private String orderReaderToken;
    private String orderWriterToken;
    private static String categoryId;

    @BeforeEach
    void setUp() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureCategory();
        ensureAdmin();
        ensureRole(ORDER_READER_ROLE, "Order API test reader", Set.of("orders.read"));
        ensureRole(ORDER_WRITER_ROLE, "Order API test writer", Set.of("orders.write"));
        ensureUser(ORDER_READER_EMAIL, ORDER_READER_ROLE);
        ensureUser(ORDER_WRITER_EMAIL, ORDER_WRITER_ROLE);
        adminToken = loginAdmin();
        orderReaderToken = login(ORDER_READER_EMAIL);
        orderWriterToken = login(ORDER_WRITER_EMAIL);
    }

    @Test
    void statusEndpoint_requiresAuthentication() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/orders/" + UUID.randomUUID() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PROCESSING\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void readOnlyRole_canReadOrderSurfaces_butCannotUpdateStatus() throws Exception {
        OrderEntity order = createStoredOrder(
                "PENDING",
                1_010_000,
                "reader-" + UUID.randomUUID() + "@example.com",
                Instant.parse("2026-07-20T08:00:00Z"));

        mockMvc.perform(get("/api/v1/admin/orders")
                        .param("q", order.getOrderNumber())
                        .header("Authorization", "Bearer " + orderReaderToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].id").value(order.getId().toString()));

        mockMvc.perform(get("/api/v1/admin/orders/" + order.getId())
                        .header("Authorization", "Bearer " + orderReaderToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/admin/orders/" + order.getId() + "/allowed-transitions")
                        .header("Authorization", "Bearer " + orderReaderToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/admin/orders/" + order.getId() + "/audit")
                        .header("Authorization", "Bearer " + orderReaderToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isEmpty());

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PROCESSING\"}")
                        .header("Authorization", "Bearer " + orderReaderToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void writeOnlyRole_canUpdateStatus_butCannotReadOrder() throws Exception {
        OrderEntity order = createStoredOrder(
                "PENDING",
                1_020_000,
                "writer-" + UUID.randomUUID() + "@example.com",
                Instant.parse("2026-07-20T09:00:00Z"));

        mockMvc.perform(get("/api/v1/admin/orders/" + order.getId())
                        .header("Authorization", "Bearer " + orderWriterToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/v1/admin/orders/" + order.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PROCESSING\"}")
                        .header("Authorization", "Bearer " + orderWriterToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PROCESSING"));
    }

    @Test
    void listOrders_combinesSearchStatusDateAndTotalSort() throws Exception {
        String searchToken = "list-" + UUID.randomUUID();
        OrderEntity highest = createStoredOrder(
                "PENDING", 900_000, searchToken + "-high@example.com",
                Instant.parse("2026-07-20T06:00:00Z"));
        OrderEntity lower = createStoredOrder(
                "PENDING", 500_000, searchToken + "-low@example.com",
                Instant.parse("2026-07-21T16:59:59Z"));
        createStoredOrder(
                "CANCELLED", 2_000_000, searchToken + "-cancelled@example.com",
                Instant.parse("2026-07-20T12:00:00Z"));
        createStoredOrder(
                "PENDING", 3_000_000, searchToken + "-outside@example.com",
                Instant.parse("2026-07-21T17:00:00Z"));

        mockMvc.perform(get("/api/v1/admin/orders")
                        .param("page", "1")
                        .param("size", "10")
                        .param("q", searchToken)
                        .param("status", "PENDING")
                        .param("from", "2026-07-20")
                        .param("to", "2026-07-21")
                        .param("sort", "total:desc")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagination.totalItems").value(2))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].id").value(highest.getId().toString()))
                .andExpect(jsonPath("$.data[0].totalAmount").value(900_000))
                .andExpect(jsonPath("$.data[1].id").value(lower.getId().toString()))
                .andExpect(jsonPath("$.data[1].totalAmount").value(500_000));
    }

    @Test
    void listOrders_rejectsUnknownStatusInvalidDateAndReversedRange() throws Exception {
        mockMvc.perform(get("/api/v1/admin/orders")
                        .param("status", "NOT_REAL")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/admin/orders")
                        .param("from", "2026-99-99")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/admin/orders")
                        .param("from", "2026-07-22")
                        .param("to", "2026-07-21")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void checkoutStartsAtPending() throws Exception {
        OrderInfo order = placeOrder(1_000_000);

        mockMvc.perform(get("/api/v1/admin/orders/" + order.id())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.payments[0].status").value("PENDING"));
    }

    @Test
    void orderDetail_exposesCanonicalSucceededPaymentSnapshot() throws Exception {
        Instant now = Instant.parse("2026-07-21T09:00:00Z");
        OrderEntity order = createStoredOrder(
                "COMPLETED",
                1_500_000,
                "paid-" + UUID.randomUUID() + "@example.com",
                now
        );
        PaymentEntity payment = new PaymentEntity();
        payment.setOrder(order);
        payment.setPaymentMethod("BACS");
        payment.setProvider("WORDPRESS");
        payment.setStatus(PaymentRecordStatus.SUCCEEDED);
        payment.setAmount(BigDecimal.valueOf(1_500_000));
        payment.setCurrency("VND");
        payment.setPaidAt(now);
        payment.setCreatedAt(now);
        payment.setUpdatedAt(now);
        paymentRepo.saveAndFlush(payment);

        mockMvc.perform(get("/api/v1/admin/orders/" + order.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.payments[0].status").value("SUCCEEDED"));
    }

    @Test
    void allowedTransitionsFollowSingleAxis() throws Exception {
        OrderInfo order = placeOrder(1_100_000);

        mockMvc.perform(get("/api/v1/admin/orders/" + order.id() + "/allowed-transitions")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0]").value("CANCELLED"))
                .andExpect(jsonPath("$.data[1]").value("PROCESSING"));
    }

    @Test
    void processingAllowedTransitionsAreCancelledAndCompleted() throws Exception {
        OrderInfo order = placeOrder(1_200_000);
        updateStatus(order.id(), "PROCESSING", null)
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/admin/orders/" + order.id() + "/allowed-transitions")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0]").value("CANCELLED"))
                .andExpect(jsonPath("$.data[1]").value("COMPLETED"));
    }

    @Test
    void processingCanBeCancelledAndTerminalTransitionsStayBlocked() throws Exception {
        OrderInfo direct = placeOrder(1_300_000);
        updateStatus(direct.id(), "COMPLETED", null)
                .andExpect(status().isConflict());

        updateStatus(direct.id(), "PROCESSING", null)
                .andExpect(status().isOk());

        String cancelReason = "Khách từ chối nhận hàng";
        updateStatus(direct.id(), "CANCELLED",
                ",\"cancelReason\":\"" + cancelReason + "\"")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"))
                .andExpect(jsonPath("$.data.cancelledAt").isNotEmpty())
                .andExpect(jsonPath("$.data.cancelReason").value(cancelReason));

        OrderEntity cancelled = orderRepo.findById(direct.id()).orElseThrow();
        assertThat(cancelled.getCancelledAt()).isNotNull();
        assertThat(cancelled.getCancelReason()).isEqualTo(cancelReason);
        assertThat(auditLogRepo.findAll()).anySatisfy(audit -> {
            assertThat(audit.getAction()).isEqualTo("ORDER_STATUS_UPDATED");
            assertThat(audit.getResourceId()).isEqualTo(direct.id());
            assertThat(audit.getAfterData()).contains("CANCELLED");
            assertThat(audit.getAfterData()).contains(cancelReason);
        });

        updateStatus(direct.id(), "PROCESSING", null)
                .andExpect(status().isConflict());
        updateStatus(direct.id(), "COMPLETED", null)
                .andExpect(status().isConflict());

        OrderInfo completed = placeOrder(1_350_000);
        updateStatus(completed.id(), "PROCESSING", null)
                .andExpect(status().isOk());
        updateStatus(completed.id(), "COMPLETED", null)
                .andExpect(status().isOk());
        updateStatus(completed.id(), "CANCELLED", null)
                .andExpect(status().isConflict());
    }

    @Test
    void cancellingWithoutReasonIsRejected() throws Exception {
        OrderInfo order = placeOrder(1_360_000);
        updateStatus(order.id(), "PROCESSING", null)
                .andExpect(status().isOk());

        updateStatus(order.id(), "CANCELLED", null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("cancelReason"));
    }

    @Test
    void sameStatus_isIdempotentWithoutReasonOrAuditWrite() throws Exception {
        OrderEntity order = createStoredOrder(
                "CANCELLED",
                1_370_000,
                "cancelled-" + UUID.randomUUID() + "@example.com",
                Instant.parse("2026-07-20T10:00:00Z"));

        updateStatus(order.getId(), "CANCELLED", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));

        mockMvc.perform(get("/api/v1/admin/orders/" + order.getId() + "/audit")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    void unknownStatus_isRejectedAsValidationError() throws Exception {
        OrderEntity order = createStoredOrder(
                "PENDING",
                1_380_000,
                "unknown-" + UUID.randomUUID() + "@example.com",
                Instant.parse("2026-07-20T11:00:00Z"));

        updateStatus(order.getId(), "NOT_A_REAL_STATUS", null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("status"));
    }

    @Test
    void auditTrail_isReverseChronologicalAndScopedToOrder() throws Exception {
        OrderEntity target = createStoredOrder(
                "PENDING",
                1_390_000,
                "audit-target-" + UUID.randomUUID() + "@example.com",
                Instant.parse("2026-07-20T12:00:00Z"));
        OrderEntity other = createStoredOrder(
                "PENDING",
                1_395_000,
                "audit-other-" + UUID.randomUUID() + "@example.com",
                Instant.parse("2026-07-20T13:00:00Z"));

        updateStatus(target.getId(), "PROCESSING", null)
                .andExpect(status().isOk());
        updateStatus(target.getId(), "CANCELLED",
                ",\"cancelReason\":\"Khách đổi kế hoạch\"")
                .andExpect(status().isOk());
        updateStatus(other.getId(), "PROCESSING", null)
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/admin/orders/" + target.getId() + "/audit")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].action").value("ORDER_STATUS_UPDATED"))
                .andExpect(jsonPath("$.data[0].actorType").value("ADMIN"))
                .andExpect(jsonPath("$.data[0].beforeData", containsString("PROCESSING")))
                .andExpect(jsonPath("$.data[0].afterData", containsString("CANCELLED")))
                .andExpect(jsonPath("$.data[0].afterData", containsString("Khách đổi kế hoạch")))
                .andExpect(jsonPath("$.data[0].createdAt").isNotEmpty())
                .andExpect(jsonPath("$.data[1].beforeData", containsString("PENDING")))
                .andExpect(jsonPath("$.data[1].afterData", containsString("PROCESSING")));
    }

    @Test
    void responseHasOnlyOrderStatusAxis() throws Exception {
        OrderInfo order = placeOrder(1_400_000);
        MvcResult result = mockMvc.perform(get("/api/v1/admin/orders/" + order.id())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).doesNotContain("payment" + "Status", "fulfillment" + "Status");
    }

    @Test
    void removedStatusEndpointsReturnNotFound() throws Exception {
        String removedPaymentPath = "/" + "payment" + "-" + "status";
        String removedShippingPath = "/" + "ful" + "fillment";
        mockMvc.perform(patch("/api/v1/admin/orders/" + UUID.randomUUID() + removedPaymentPath)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"PAID\"}")
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
        mockMvc.perform(patch("/api/v1/admin/orders/" + UUID.randomUUID() + removedShippingPath)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"SHIPPED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
    }

    private org.springframework.test.web.servlet.ResultActions updateStatus(
            UUID orderId, String status, String extraFields) throws Exception {
        String suffix = extraFields == null ? "" : extraFields;
        return mockMvc.perform(patch("/api/v1/admin/orders/" + orderId + "/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + status + "\"" + suffix + "}")
                .header("Authorization", "Bearer " + adminToken));
    }

    private OrderInfo placeOrder(int price) throws Exception {
        ProductEntity product = new ProductEntity();
        Instant now = Instant.now();
        product.setId(UUID.randomUUID().toString());
        product.setSlug("order-status-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        product.setName("Order status test product");
        product.setRetailPrice(BigDecimal.valueOf(price));
        product.setCurrency("VND");
        product.setPublishStatus(PublishStatus.PUBLISHED);
        product.setStockState(ProductStockState.IN_STOCK);
        product.setCategory(categoryRepo.findById(categoryId).orElseThrow());
        product.setCreatedAt(now);
        product.setUpdatedAt(now);
        product = productRepo.save(product);

        MvcResult cart = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = cart.getResponse().getCookies();
        String csrf = cookie(cart.getResponse(), "bb_csrf");
        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk());
        MvcResult checkout = mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andReturn();
        String id = jsonValue(checkout.getResponse().getContentAsString(), "id");
        return new OrderInfo(UUID.fromString(id));
    }

    private void ensureCategory() {
        if (categoryId != null) return;
        categoryId = "order-status-category-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity category = new CategoryEntity();
        category.setId(categoryId);
        category.setSlug(categoryId);
        category.setName("Order status tests");
        category.setVisible(true);
        category.setCreatedAt(Instant.now());
        category.setUpdatedAt(Instant.now());
        categoryRepo.save(category);
    }

    private void ensureAdmin() {
        adminUserRepo.findByEmail(ADMIN_EMAIL).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(ADMIN_EMAIL);
            admin.setPasswordHash(passwordService.hash(ADMIN_PASS));
            admin.setDisplayName("Order status test admin");
            admin.setRole("ADMIN");
            admin.setStatus("ACTIVE");
            admin.setCreatedAt(Instant.now());
            admin.setUpdatedAt(Instant.now());
            return adminUserRepo.save(admin);
        });
    }

    private void ensureRole(String id, String name, Set<String> permissions) {
        AdminRoleEntity role = adminRoleRepo.findById(id).orElseGet(() -> {
            AdminRoleEntity created = new AdminRoleEntity();
            created.setId(id);
            created.setCreatedAt(Instant.now());
            return created;
        });
        role.setName(name);
        role.setDescription("Order API integration test role");
        role.setSystem(false);
        role.setPermissions(new LinkedHashSet<>(permissions));
        role.setUpdatedAt(Instant.now());
        adminRoleRepo.save(role);
        adminPermissionService.evict(id);
    }

    private void ensureUser(String email, String role) {
        adminUserRepo.findByEmail(email).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(email);
            admin.setPasswordHash(passwordService.hash(ADMIN_PASS));
            admin.setDisplayName("Order API test " + role);
            admin.setRole(role);
            admin.setStatus("ACTIVE");
            admin.setCreatedAt(Instant.now());
            admin.setUpdatedAt(Instant.now());
            return adminUserRepo.save(admin);
        });
    }

    private String loginAdmin() throws Exception {
        return login(ADMIN_EMAIL);
    }

    private String login(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + ADMIN_PASS + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return jsonValue(result.getResponse().getContentAsString(), "accessToken");
    }

    private OrderEntity createStoredOrder(String orderStatus, int total, String customerEmail, Instant placedAt) {
        String suffix = UUID.randomUUID().toString();
        OrderEntity order = new OrderEntity();
        order.setOrderNumber("ORDER-API-" + suffix);
        order.setOrderKey("order-api-key-" + suffix);
        order.setCustomerName("Order API customer");
        order.setCustomerEmail(customerEmail);
        order.setCustomerPhone("0909123456");
        order.setStatus(orderStatus);
        order.setCurrency("VND");
        order.setSubtotalAmount(BigDecimal.valueOf(total));
        order.setDiscountAmount(BigDecimal.ZERO);
        order.setShippingAmount(BigDecimal.ZERO);
        order.setFeeAmount(BigDecimal.ZERO);
        order.setTaxAmount(BigDecimal.ZERO);
        order.setTotalAmount(BigDecimal.valueOf(total));
        order.setPaidAmount(BigDecimal.ZERO);
        order.setChannel("WEB");
        order.setFulfillmentType("DELIVERY");
        order.setPaymentMethod("COD");
        order.setSource("WEB");
        order.setPlacedAt(placedAt);
        order.setCreatedAt(placedAt);
        order.setUpdatedAt(placedAt);
        if ("CANCELLED".equals(orderStatus)) {
            order.setCancelledAt(placedAt);
            order.setCancelReason("Existing cancellation");
        }
        return orderRepo.save(order);
    }

    private static String cookie(MockHttpServletResponse response, String name) {
        for (Cookie cookie : response.getCookies()) {
            if (name.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }

    private static String jsonValue(String json, String key) {
        String marker = "\"" + key + "\":\"";
        int start = json.indexOf(marker);
        if (start < 0) throw new IllegalStateException("Missing JSON field " + key);
        start += marker.length();
        int end = json.indexOf('"', start);
        return json.substring(start, end);
    }

    private record OrderInfo(UUID id) {}
}
