package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
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
class AdminReportApiTest {

    private static final String ADMIN_EMAIL = "report-admin-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS  = "Admin@Report12345678";
    private static final String EDITOR_EMAIL = "report-editor-" + UUID.randomUUID() + "@bigbike.test";
    private static final String EDITOR_PASS  = "Editor@Report12345678";

    // today and tomorrow in YYYY-MM-DD — used to scope seeded orders to the analytics range
    private static final String TODAY    = LocalDate.now().toString();
    private static final String TOMORROW = LocalDate.now().plusDays(1).toString();

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired OrderJpaRepository orderRepo;
    @Autowired CustomerJpaRepository customerRepo;
    @Autowired AuditLogJpaRepository auditLogRepo;
    @Autowired PasswordService passwordService;

    private MockMvc mockMvc;
    private String adminToken;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureAdmin();
        ensureEditor();
        adminToken = loginAs(ADMIN_EMAIL, ADMIN_PASS);
    }

    // ── 1. Auth / permission ──────────────────────────────────────────────────

    @Test
    void analytics_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/reports/analytics"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void analytics_editorRole_returns403() throws Exception {
        // EDITOR has no reports.read permission
        String editorToken = loginAs(EDITOR_EMAIL, EDITOR_PASS);
        mockMvc.perform(get("/api/v1/admin/reports/analytics")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void analytics_adminRole_returns200() throws Exception {
        mockMvc.perform(get("/api/v1/admin/reports/analytics")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    // ── 2. Response shape — all summary fields present ──────────────────────

    @Test
    void analytics_defaultRange_returnsAllSummaryFields() throws Exception {
        mockMvc.perform(get("/api/v1/admin/reports/analytics")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.grossOrderValue").exists())
                .andExpect(jsonPath("$.summary.paidRevenue").exists())
                .andExpect(jsonPath("$.summary.orderCount").exists())
                .andExpect(jsonPath("$.summary.avgOrderValue").exists())
                .andExpect(jsonPath("$.dailyRevenue").isArray())
                .andExpect(jsonPath("$.topProducts").isArray())
                .andExpect(jsonPath("$.topCustomers").isArray());
    }

    // ── 3. Date validation ────────────────────────────────────────────────────

    @Test
    void analytics_invalidDateFormat_returns400() throws Exception {
        mockMvc.perform(get("/api/v1/admin/reports/analytics?from=not-a-date")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void analytics_fromAfterTo_returns400() throws Exception {
        mockMvc.perform(get("/api/v1/admin/reports/analytics?from=" + TOMORROW + "&to=" + TODAY)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void exportOrders_invalidStatus_returns400() throws Exception {
        mockMvc.perform(get("/api/v1/admin/reports/orders/export?status=NOT_REAL_STATUS")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void exportOrders_editorWithoutExportPermission_returns403() throws Exception {
        String editorToken = loginAs(EDITOR_EMAIL, EDITOR_PASS);
        mockMvc.perform(get("/api/v1/admin/reports/orders/export")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void exportOrders_rejectsInvalidOrReversedCalendarDates() throws Exception {
        mockMvc.perform(get("/api/v1/admin/reports/orders/export?from=not-a-date")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/admin/reports/orders/export?from=2026-07-22&to=2026-07-21")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // ── 4. GMV excludes CANCELLED ─────────────────────────────────────────────

    @Test
    void analytics_cancelledOrders_excludedFromGrossOrderValue() throws Exception {
        double baseline = fetchGrossOrderValue();

        Instant now = Instant.now();
        orderRepo.save(buildOrder("COMPLETED", "500000", null, now));
        orderRepo.save(buildOrder("CANCELLED", "200000", null, now));

        double after = fetchGrossOrderValue();
        double delta = after - baseline;

        // COMPLETED order adds 500k; CANCELLED adds nothing
        assertThat(delta).isEqualTo(500_000.0);
    }

    // ── 5. Audit log for CSV exports ──────────────────────────────────────────

    @Test
    void exportOrders_writesAuditLog() throws Exception {
        long before = countExportAuditLogs("ORDERS");
        String privateSearch = "private-" + UUID.randomUUID() + "@bigbike.test";

        MvcResult started = mockMvc.perform(get("/api/v1/admin/reports/orders/export")
                        .param("q", privateSearch)
                        .param("status", "COMPLETED")
                        .param("from", TODAY)
                        .param("to", TODAY)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(request().asyncStarted())
                .andReturn();
        mockMvc.perform(asyncDispatch(started))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Export-Uncapped", "true"));

        List<AuditLogEntity> logs = exportAuditLogs("ORDERS");
        assertThat(logs).hasSizeGreaterThan((int) before);
        AuditLogEntity log = logs.get(logs.size() - 1);
        assertThat(log.getResourceType()).isEqualTo("REPORT");
        assertThat(log.getAction()).isEqualTo("REPORT_EXPORT_CREATED");
        assertThat(log.getAfterData()).contains("\"exportType\":\"ORDERS\"");
        assertThat(log.getAfterData()).contains("\"status\":\"COMPLETED\"");
        assertThat(log.getAfterData()).contains("\"searchApplied\":true");
        assertThat(log.getAfterData()).contains("\"rowLimit\":null");
        assertThat(log.getAfterData()).contains("\"uncapped\":true");
        assertThat(log.getAfterData()).doesNotContain(privateSearch);
        assertThat(log.getAfterData()).doesNotContain("email");
        assertThat(log.getAfterData()).doesNotContain("phone");
        assertThat(log.getAfterData()).doesNotContain("name");
    }

    @Test
    void exportOrders_appliesSearchStatusAndVietnamCalendarBoundaries() throws Exception {
        String searchToken = "csv-" + UUID.randomUUID();
        OrderEntity included = buildOrder(
                "PROCESSING", "700000", null, Instant.parse("2026-07-21T16:59:59Z")
        );
        included.setCustomerEmail(searchToken + "-included@example.com");
        orderRepo.save(included);

        OrderEntity wrongStatus = buildOrder(
                "CANCELLED", "800000", null, Instant.parse("2026-07-21T12:00:00Z")
        );
        wrongStatus.setCustomerEmail(searchToken + "-wrong-status@example.com");
        orderRepo.save(wrongStatus);

        OrderEntity nextVietnamDay = buildOrder(
                "PROCESSING", "900000", null, Instant.parse("2026-07-21T17:00:00Z")
        );
        nextVietnamDay.setCustomerEmail(searchToken + "-outside@example.com");
        orderRepo.save(nextVietnamDay);

        MvcResult started = mockMvc.perform(get("/api/v1/admin/reports/orders/export")
                        .param("q", searchToken)
                        .param("status", "PROCESSING")
                        .param("from", "2026-07-21")
                        .param("to", "2026-07-21")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(request().asyncStarted())
                .andReturn();
        MvcResult completed = mockMvc.perform(asyncDispatch(started))
                .andExpect(status().isOk())
                .andReturn();

        String csv = completed.getResponse().getContentAsString();
        assertThat(csv).contains(included.getOrderNumber());
        assertThat(csv).doesNotContain(wrongStatus.getOrderNumber());
        assertThat(csv).doesNotContain(nextVietnamDay.getOrderNumber());
    }

    @Test
    void exportCustomers_writesAuditLog() throws Exception {
        long before = countExportAuditLogs("CUSTOMERS");
        String privateSearch = "private-customer-" + UUID.randomUUID();

        MvcResult started = mockMvc.perform(get("/api/v1/admin/reports/customers/export")
                        .param("q", privateSearch)
                        .param("status", "ACTIVE")
                        .param("synthetic", "true")
                        .param("emailVerified", "false")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(request().asyncStarted())
                .andReturn();
        mockMvc.perform(asyncDispatch(started))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Export-Uncapped", "true"));

        List<AuditLogEntity> logs = exportAuditLogs("CUSTOMERS");
        assertThat(logs).hasSizeGreaterThan((int) before);
        AuditLogEntity log = logs.get(logs.size() - 1);
        assertThat(log.getResourceType()).isEqualTo("REPORT");
        assertThat(log.getAction()).isEqualTo("REPORT_EXPORT_CREATED");
        assertThat(log.getAfterData()).contains("\"exportType\":\"CUSTOMERS\"");
        assertThat(log.getAfterData()).contains("\"status\":\"ACTIVE\"");
        assertThat(log.getAfterData()).contains("\"searchApplied\":true");
        assertThat(log.getAfterData()).contains("\"synthetic\":true");
        assertThat(log.getAfterData()).contains("\"emailVerified\":false");
        assertThat(log.getAfterData()).contains("\"rowLimit\":null");
        assertThat(log.getAfterData()).contains("\"uncapped\":true");
        assertThat(log.getAfterData()).doesNotContain(privateSearch);
    }

    @Test
    void exportCustomersAppliesEveryCustomersScreenFilter() throws Exception {
        String marker = "customer-csv-" + UUID.randomUUID();
        CustomerEntity included = buildCustomer(marker + "-included@bigbike.test", "DISABLED", true, true);
        CustomerEntity wrongStatus =
                buildCustomer(marker + "-wrong-status@bigbike.test", "ACTIVE", true, true);
        CustomerEntity wrongSynthetic =
                buildCustomer(marker + "-wrong-synthetic@bigbike.test", "DISABLED", false, true);
        CustomerEntity wrongVerification =
                buildCustomer(marker + "-wrong-verification@bigbike.test", "DISABLED", true, false);
        customerRepo.saveAllAndFlush(
                List.of(included, wrongStatus, wrongSynthetic, wrongVerification));

        MvcResult started = mockMvc.perform(get("/api/v1/admin/reports/customers/export")
                        .param("q", marker)
                        .param("status", "disabled")
                        .param("synthetic", "true")
                        .param("emailVerified", "true")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(request().asyncStarted())
                .andReturn();
        MvcResult completed = mockMvc.perform(asyncDispatch(started))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Export-Uncapped", "true"))
                .andReturn();

        String csv = completed.getResponse().getContentAsString();
        assertThat(csv).contains(included.getEmail());
        assertThat(csv).doesNotContain(wrongStatus.getEmail());
        assertThat(csv).doesNotContain(wrongSynthetic.getEmail());
        assertThat(csv).doesNotContain(wrongVerification.getEmail());
    }

    @Test
    void exportProducts_writesAuditLog() throws Exception {
        long before = countExportAuditLogs("PRODUCTS");

        mockMvc.perform(get("/api/v1/admin/reports/products/export?publishStatus=PUBLISHED")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        List<AuditLogEntity> logs = exportAuditLogs("PRODUCTS");
        assertThat(logs).hasSizeGreaterThan((int) before);
        AuditLogEntity log = logs.get(logs.size() - 1);
        assertThat(log.getResourceType()).isEqualTo("REPORT");
        assertThat(log.getAction()).isEqualTo("REPORT_EXPORT_CREATED");
        assertThat(log.getAfterData()).contains("\"exportType\":\"PRODUCTS\"");
        assertThat(log.getAfterData()).contains("\"publishStatus\":\"PUBLISHED\"");
        assertThat(log.getAfterData()).doesNotContain("email");
        assertThat(log.getAfterData()).doesNotContain("phone");
        assertThat(log.getAfterData()).doesNotContain("name");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private List<AuditLogEntity> exportAuditLogs(String exportType) {
        return auditLogRepo.findAll().stream()
                .filter(l -> "REPORT_EXPORT_CREATED".equals(l.getAction())
                        && l.getAfterData() != null
                        && l.getAfterData().contains("\"" + exportType + "\""))
                .toList();
    }

    private long countExportAuditLogs(String exportType) {
        return exportAuditLogs(exportType).size();
    }

    private double fetchGrossOrderValue() throws Exception {
        return fetchSummaryField("grossOrderValue");
    }

    private double fetchPaidRevenue() throws Exception {
        return fetchSummaryField("paidRevenue");
    }

    private double fetchSummaryField(String field) throws Exception {
        MvcResult r = mockMvc.perform(get("/api/v1/admin/reports/analytics?from=" + TODAY + "&to=" + TODAY)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        return extractJsonDouble(r.getResponse().getContentAsString(), field);
    }

    /**
     * Builds a test order. paidAmount defaults to totalAmount (cash collected equals order total).
     * Override paidAmount after calling this method for edge-case tests.
     */
    private OrderEntity buildOrder(String status,
                                   String totalAmount, String refundAmount, Instant placedAt) {
        OrderEntity o = new OrderEntity();
        o.setOrderNumber("RPT-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        o.setStatus(status);
        o.setTotalAmount(new BigDecimal(totalAmount));
        o.setPaidAmount(new BigDecimal(totalAmount)); // default: all cash collected
        // Refund bookkeeping removed from OrderEntity (refund feature dropped) — param kept inert.
        o.setPlacedAt(placedAt);
        o.setCreatedAt(placedAt);
        o.setUpdatedAt(placedAt);
        return o;
    }

    private CustomerEntity buildCustomer(
            String email, String status, boolean synthetic, boolean emailVerified
    ) {
        CustomerEntity customer = new CustomerEntity();
        customer.setEmail(email);
        customer.setDisplayName("Report Customer");
        customer.setStatus(status);
        customer.setSynthetic(synthetic);
        if (emailVerified) {
            customer.setEmailVerifiedAt(Instant.now());
        }
        customer.setCreatedAt(Instant.now());
        customer.setUpdatedAt(customer.getCreatedAt());
        return customer;
    }

    private void ensureAdmin() {
        adminUserRepo.findByEmail(ADMIN_EMAIL).orElseGet(() -> {
            AdminUserEntity a = new AdminUserEntity();
            a.setEmail(ADMIN_EMAIL);
            a.setPasswordHash(passwordService.hash(ADMIN_PASS));
            a.setDisplayName("Report Test Admin");
            a.setRole("ADMIN");
            a.setStatus("ACTIVE");
            Instant now = Instant.now();
            a.setCreatedAt(now);
            a.setUpdatedAt(now);
            return adminUserRepo.save(a);
        });
    }

    private void ensureEditor() {
        adminUserRepo.findByEmail(EDITOR_EMAIL).orElseGet(() -> {
            AdminUserEntity e = new AdminUserEntity();
            e.setEmail(EDITOR_EMAIL);
            e.setPasswordHash(passwordService.hash(EDITOR_PASS));
            e.setDisplayName("Report Test Editor");
            e.setRole("EDITOR");
            e.setStatus("ACTIVE");
            Instant now = Instant.now();
            e.setCreatedAt(now);
            e.setUpdatedAt(now);
            return adminUserRepo.save(e);
        });
    }

    private String loginAs(String email, String pass) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + pass + "\"}"))
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
        if (end < 0) return 0.0;
        try {
            return Double.parseDouble(json.substring(start, end).trim());
        } catch (NumberFormatException ex) {
            return 0.0;
        }
    }
}
