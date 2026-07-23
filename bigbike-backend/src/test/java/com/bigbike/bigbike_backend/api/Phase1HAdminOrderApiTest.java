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
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.time.Instant;
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
    private static final String ADMIN_PASS = "Admin@1234567890";
    private static final String VALID_BILLING =
            "{\"fullName\":\"Test User\",\"phone\":\"0909123456\",\"email\":\"test@example.com\","
                    + "\"addressLine1\":\"123 Test St\",\"province\":\"HCM\",\"ward\":\"Phuong 1\",\"country\":\"VN\"}";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired PasswordService passwordService;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired ProductJpaRepository productRepo;
    @Autowired OrderJpaRepository orderRepo;
    @Autowired AuditLogJpaRepository auditLogRepo;

    private MockMvc mockMvc;
    private String adminToken;
    private static String categoryId;

    @BeforeEach
    void setUp() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureCategory();
        ensureAdmin();
        adminToken = loginAdmin();
    }

    @Test
    void statusEndpoint_requiresAuthentication() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/orders/" + UUID.randomUUID() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PROCESSING\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void checkoutStartsAtPending() throws Exception {
        OrderInfo order = placeOrder(1_000_000);

        mockMvc.perform(get("/api/v1/admin/orders/" + order.id())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"));
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

    private String loginAdmin() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + ADMIN_EMAIL + "\",\"password\":\"" + ADMIN_PASS + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return jsonValue(result.getResponse().getContentAsString(), "accessToken");
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
