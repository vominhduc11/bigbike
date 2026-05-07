package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
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
class AdminDashboardApiTest {

    private static final String ADMIN_EMAIL    = "dash-admin-"   + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS     = "Admin@Dash12345678";
    private static final String SHOP_MGR_EMAIL = "dash-shopmgr-" + UUID.randomUUID() + "@bigbike.test";
    private static final String SHOP_MGR_PASS  = "ShopMgr@Dash12345678";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired OrderJpaRepository orderRepo;
    @Autowired OrderLineItemJpaRepository lineItemRepo;
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

    // ── 1. No auth → 401 ─────────────────────────────────────────────────────

    @Test
    void getDashboard_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dashboard"))
                .andExpect(status().isUnauthorized());
    }

    // ── 2. ADMIN → 200, correct top-level JSON shape ──────────────────────────

    @Test
    void getDashboard_withAdminAuth_returns200AndCorrectShape() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dashboard")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.kpi").exists())
                .andExpect(jsonPath("$.data.kpi.todayRevenue").exists())
                .andExpect(jsonPath("$.data.kpi.todayPaidRevenue").exists())
                .andExpect(jsonPath("$.data.kpi.todayOrders").exists())
                .andExpect(jsonPath("$.data.kpi.pendingOrders").exists())
                .andExpect(jsonPath("$.data.kpi.activeProducts").exists())
                .andExpect(jsonPath("$.data.revenueData").isArray())
                .andExpect(jsonPath("$.data.orderStatusBreakdown").isArray())
                .andExpect(jsonPath("$.data.recentOrders").isArray())
                .andExpect(jsonPath("$.data.topProducts").isArray());
    }

    // ── 3. SHOP_MANAGER → 200 (P0-3: was 403 before SecurityConfig fix) ──────

    @Test
    void getDashboard_withShopManagerAuth_returns200() throws Exception {
        String shopMgrToken = loginShopManager();
        mockMvc.perform(get("/api/v1/admin/dashboard")
                        .header("Authorization", "Bearer " + shopMgrToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.kpi").exists());
    }

    // ── 4. Revenue exclusion: CANCELLED order must not appear in todayRevenue ─
    // Seeds COMPLETED (+500,000) and CANCELLED (+200,000).
    // The delta of todayRevenue must equal exactly 500,000, not 700,000.

    @Test
    void getDashboard_todayRevenue_excludesCancelledOrders() throws Exception {
        // Baseline — read todayRevenue before seeding
        double baseline = fetchTodayRevenue();

        Instant now = Instant.now();
        orderRepo.save(buildOrder("COMPLETED", "PAID",      BigDecimal.valueOf(500_000), now));
        orderRepo.save(buildOrder("CANCELLED", "CANCELLED", BigDecimal.valueOf(200_000), now));

        double after = fetchTodayRevenue();
        double delta = after - baseline;

        // Delta must include the 500k COMPLETED order but NOT the 200k CANCELLED order
        assertThat(delta).isEqualTo(500_000.0);
    }

    // ── 5. Revenue exclusion: FAILED and REFUNDED also excluded ──────────────

    @Test
    void getDashboard_todayRevenue_excludesFailedAndRefundedOrders() throws Exception {
        double baseline = fetchTodayRevenue();

        Instant now = Instant.now();
        orderRepo.save(buildOrder("PROCESSING", "PENDING",  BigDecimal.valueOf(300_000), now));
        orderRepo.save(buildOrder("FAILED",     "FAILED",   BigDecimal.valueOf(100_000), now));
        orderRepo.save(buildOrder("REFUNDED",   "REFUNDED", BigDecimal.valueOf(150_000), now));

        double after = fetchTodayRevenue();
        double delta = after - baseline;

        // Only PROCESSING counts; FAILED and REFUNDED are excluded
        assertThat(delta).isEqualTo(300_000.0);
    }

    // ── 6. recentOrders contains customerName field (P1-4) ───────────────────

    @Test
    void getDashboard_recentOrders_customerNameFieldPresent() throws Exception {
        Instant now = Instant.now();
        OrderEntity order = buildOrder("COMPLETED", "PAID", BigDecimal.valueOf(100_000), now);
        order.setCustomerName("Nguyen Van Dashboard");
        order.setCustomerEmail("dashboard-test@bigbike.test");
        orderRepo.save(order);

        MvcResult result = mockMvc.perform(get("/api/v1/admin/dashboard")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();

        // customerName key must be serialized in the JSON (present even when null)
        assertThat(result.getResponse().getContentAsString()).contains("\"customerName\"");
        // The order we seeded should be the most recent — assert its name appears
        assertThat(result.getResponse().getContentAsString()).contains("Nguyen Van Dashboard");
    }

    // ── 7. topProducts.productId is String, not UUID (P0-2) ──────────────────
    // Seeds an order_line_item with product_pk = "prod_<hex>" and verifies the
    // dashboard serializes it as a string value (not null, not UUID-parsed).

    @Test
    void getDashboard_topProducts_productIdIsVarcharString() throws Exception {
        Instant now = Instant.now();
        String productPk = "prod_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);

        OrderEntity order = buildOrder("COMPLETED", "PAID", BigDecimal.valueOf(999_000), now);
        orderRepo.save(order);

        OrderLineItemEntity li = new OrderLineItemEntity();
        li.setOrder(order);
        li.setProductName("Dashboard Verify Product");
        li.setProductPk(productPk);
        li.setQuantity(1);
        li.setUnitPrice(BigDecimal.valueOf(999_000));
        li.setLineSubtotal(BigDecimal.valueOf(999_000));
        li.setLineDiscount(BigDecimal.ZERO);
        li.setLineTax(BigDecimal.ZERO);
        li.setLineTotal(BigDecimal.valueOf(999_000));
        li.setCreatedAt(now);
        li.setUpdatedAt(now);
        lineItemRepo.save(li);

        MvcResult result = mockMvc.perform(get("/api/v1/admin/dashboard?period=7d")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.topProducts").isArray())
                .andReturn();

        String json = result.getResponse().getContentAsString();
        // The product_pk we seeded must appear as the productId in topProducts
        assertThat(json).contains(productPk);
    }

    // ── 8. Different period params all return 200 with revenueData array ──────

    @Test
    void getDashboard_allValidPeriods_return200() throws Exception {
        for (String period : new String[]{"7d", "30d", "90d"}) {
            mockMvc.perform(get("/api/v1/admin/dashboard?period=" + period)
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.revenueData").isArray());
        }
    }

    // ── 9. Unknown period param falls back to 30d (no 400/500) ───────────────

    @Test
    void getDashboard_unknownPeriod_fallsBackTo30dGracefully() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dashboard?period=999z")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.revenueData").isArray());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private double fetchTodayRevenue() throws Exception {
        MvcResult r = mockMvc.perform(get("/api/v1/admin/dashboard?period=7d")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        return extractJsonDouble(r.getResponse().getContentAsString(), "todayRevenue");
    }

    private OrderEntity buildOrder(String status, String paymentStatus, BigDecimal total, Instant placedAt) {
        OrderEntity o = new OrderEntity();
        o.setOrderNumber("DASH-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        o.setStatus(status);
        o.setPaymentStatus(paymentStatus);
        o.setTotalAmount(total);
        o.setPlacedAt(placedAt);
        o.setCreatedAt(placedAt);
        o.setUpdatedAt(placedAt);
        return o;
    }

    private void ensureAdminUser() {
        adminUserRepo.findByEmail(ADMIN_EMAIL).orElseGet(() -> {
            AdminUserEntity a = new AdminUserEntity();
            a.setEmail(ADMIN_EMAIL);
            a.setPasswordHash(passwordService.hash(ADMIN_PASS));
            a.setDisplayName("Dashboard Test Admin");
            a.setRole("ADMIN");
            a.setStatus("ACTIVE");
            Instant now = Instant.now();
            a.setCreatedAt(now);
            a.setUpdatedAt(now);
            return adminUserRepo.save(a);
        });
    }

    private void ensureShopManagerUser() {
        adminUserRepo.findByEmail(SHOP_MGR_EMAIL).orElseGet(() -> {
            AdminUserEntity m = new AdminUserEntity();
            m.setEmail(SHOP_MGR_EMAIL);
            m.setPasswordHash(passwordService.hash(SHOP_MGR_PASS));
            m.setDisplayName("Dashboard Test ShopManager");
            m.setRole("SHOP_MANAGER");
            m.setStatus("ACTIVE");
            Instant now = Instant.now();
            m.setCreatedAt(now);
            m.setUpdatedAt(now);
            return adminUserRepo.save(m);
        });
    }

    private String loginAdmin() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + ADMIN_EMAIL + "\",\"password\":\"" + ADMIN_PASS + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return extractJsonString(r.getResponse().getContentAsString(), "accessToken");
    }

    private String loginShopManager() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + SHOP_MGR_EMAIL + "\",\"password\":\"" + SHOP_MGR_PASS + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return extractJsonString(r.getResponse().getContentAsString(), "accessToken");
    }

    private String extractJsonString(String json, String key) {
        String marker = "\"" + key + "\":\"";
        int start = json.indexOf(marker);
        if (start < 0) return null;
        start += marker.length();
        int end = json.indexOf("\"", start);
        return json.substring(start, end);
    }

    private double extractJsonDouble(String json, String key) {
        String marker = "\"" + key + "\":";
        int start = json.indexOf(marker);
        if (start < 0) return 0.0;
        start += marker.length();
        int end = json.indexOf(",", start);
        if (end < 0) end = json.indexOf("}", start);
        return Double.parseDouble(json.substring(start, end).trim());
    }
}
