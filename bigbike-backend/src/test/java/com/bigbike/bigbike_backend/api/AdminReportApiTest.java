package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
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

    // ── 2. Response shape — all 6 summary fields present ─────────────────────

    @Test
    void analytics_defaultRange_returnsAllSixSummaryFields() throws Exception {
        mockMvc.perform(get("/api/v1/admin/reports/analytics")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.grossOrderValue").exists())
                .andExpect(jsonPath("$.summary.paidRevenue").exists())
                .andExpect(jsonPath("$.summary.refundAmount").exists())
                .andExpect(jsonPath("$.summary.netRevenue").exists())
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

    // ── 4. GMV excludes CANCELLED/FAILED — REFUNDED stays ────────────────────

    @Test
    void analytics_cancelledOrders_excludedFromGrossOrderValue() throws Exception {
        double baseline = fetchGrossOrderValue();

        Instant now = Instant.now();
        orderRepo.save(buildOrder("COMPLETED", "PAID", "500000", null, now));
        orderRepo.save(buildOrder("CANCELLED", "CANCELLED", "200000", null, now));

        double after = fetchGrossOrderValue();
        double delta = after - baseline;

        // COMPLETED order adds 500k; CANCELLED adds nothing
        assertThat(delta).isEqualTo(500_000.0);
    }

    @Test
    void analytics_refundedOrders_includedInGrossOrderValue() throws Exception {
        double baseline = fetchGrossOrderValue();

        Instant now = Instant.now();
        orderRepo.save(buildOrder("REFUNDED", "REFUNDED", "300000", "300000", now));

        double after = fetchGrossOrderValue();
        double delta = after - baseline;

        // REFUNDED order still counts as GMV (real demand placed)
        assertThat(delta).isEqualTo(300_000.0);
    }

    // ── 5. paidRevenue includes REFUNDED ──────────────────────────────────────
    // Per REPORT_RULE_002: paidAmount is never reduced by RefundService.applyRefund().
    // An order with paymentStatus=REFUNDED still contributed paidAmount cash.

    @Test
    void analytics_paidRevenue_includesRefundedPaymentStatus() throws Exception {
        double baseline = fetchPaidRevenue();

        Instant now = Instant.now();
        // Order: totalAmount=400k, paidAmount=400k, then fully refunded
        orderRepo.save(buildOrder("REFUNDED", "REFUNDED", "400000", "100000", now));

        double after = fetchPaidRevenue();
        double delta = after - baseline;

        // paidAmount=400k should be in paidRevenue even though paymentStatus=REFUNDED
        assertThat(delta).isEqualTo(400_000.0);
    }

    @Test
    void analytics_paidRevenue_refundedStatus_isIncluded() throws Exception {
        // PARTIALLY_REFUNDED removed — REFUNDED is the only post-refund status
        double baseline = fetchPaidRevenue();

        Instant now = Instant.now();
        // Order paid 600k, then refunded 100k → paymentStatus=REFUNDED
        orderRepo.save(buildOrder("COMPLETED", "REFUNDED", "600000", "100000", now));

        double after = fetchPaidRevenue();
        double delta = after - baseline;

        assertThat(delta).isEqualTo(600_000.0);
    }

    // ── 6. netRevenue = paidRevenue - refundAmount ────────────────────────────

    @Test
    void analytics_netRevenue_equalsPartialRefundDiff() throws Exception {
        // Seed: paidAmount=1,000,000; refundAmount=200,000 → netRevenue contribution = +800,000
        double baseNet = fetchNetRevenue();
        double basePaid = fetchPaidRevenue();
        double baseRefund = fetchRefundAmount();

        Instant now = Instant.now();
        // Order placed today; paid 1M; refunded 200k
        OrderEntity o = buildOrder("COMPLETED", "REFUNDED", "1000000", "200000", now);
        o.setPaidAmount(new BigDecimal("1000000"));
        orderRepo.save(o);

        double afterNet = fetchNetRevenue();
        double afterPaid = fetchPaidRevenue();
        double afterRefund = fetchRefundAmount();

        double paidDelta   = afterPaid   - basePaid;
        double refundDelta = afterRefund - baseRefund;
        double netDelta    = afterNet    - baseNet;

        assertThat(paidDelta).isEqualTo(1_000_000.0);
        assertThat(refundDelta).isEqualTo(200_000.0);
        // netDelta must equal paidDelta - refundDelta (no clamp)
        assertThat(netDelta).isEqualTo(paidDelta - refundDelta);
    }

    @Test
    void analytics_netRevenue_canBeNegative_whenRefundExceedsPaid() throws Exception {
        // This tests REPORT_RULE_004: no clamp on negative netRevenue
        double baseNet = fetchNetRevenue();

        Instant now = Instant.now();
        // Unusual scenario: paidAmount=0 (credit/unpaid), refundAmount=50k (manual refund)
        OrderEntity o = buildOrder("REFUNDED", "REFUNDED", "500000", "50000", now);
        o.setPaidAmount(BigDecimal.ZERO); // override default (test: zero cash collected)
        orderRepo.save(o);

        double afterNet = fetchNetRevenue();
        double delta = afterNet - baseNet;

        // netRevenue delta = paidRevenue delta(0) - refundAmount delta(50k) = -50k
        // Must be -50000, not 0 (no clamp)
        assertThat(delta).isEqualTo(-50_000.0);
    }

    // ── 7. Audit log for CSV exports ──────────────────────────────────────────

    @Test
    void exportOrders_writesAuditLog() throws Exception {
        long before = countExportAuditLogs("ORDERS");

        mockMvc.perform(get("/api/v1/admin/reports/orders/export?status=COMPLETED&from=" + TODAY + "&to=" + TODAY)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        List<AuditLogEntity> logs = exportAuditLogs("ORDERS");
        assertThat(logs).hasSizeGreaterThan((int) before);
        AuditLogEntity log = logs.get(logs.size() - 1);
        assertThat(log.getResourceType()).isEqualTo("REPORT");
        assertThat(log.getAction()).isEqualTo("REPORT_EXPORT_CREATED");
        assertThat(log.getAfterData()).contains("\"exportType\":\"ORDERS\"");
        assertThat(log.getAfterData()).contains("\"status\":\"COMPLETED\"");
        assertThat(log.getAfterData()).contains("\"rowLimit\":10000");
        assertThat(log.getAfterData()).doesNotContain("email");
        assertThat(log.getAfterData()).doesNotContain("phone");
        assertThat(log.getAfterData()).doesNotContain("name");
    }

    @Test
    void exportCustomers_writesAuditLog() throws Exception {
        long before = countExportAuditLogs("CUSTOMERS");

        mockMvc.perform(get("/api/v1/admin/reports/customers/export?status=ACTIVE")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        List<AuditLogEntity> logs = exportAuditLogs("CUSTOMERS");
        assertThat(logs).hasSizeGreaterThan((int) before);
        AuditLogEntity log = logs.get(logs.size() - 1);
        assertThat(log.getResourceType()).isEqualTo("REPORT");
        assertThat(log.getAction()).isEqualTo("REPORT_EXPORT_CREATED");
        assertThat(log.getAfterData()).contains("\"exportType\":\"CUSTOMERS\"");
        assertThat(log.getAfterData()).contains("\"status\":\"ACTIVE\"");
        assertThat(log.getAfterData()).doesNotContain("email");
        assertThat(log.getAfterData()).doesNotContain("phone");
        assertThat(log.getAfterData()).doesNotContain("name");
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

    private double fetchRefundAmount() throws Exception {
        return fetchSummaryField("refundAmount");
    }

    private double fetchNetRevenue() throws Exception {
        return fetchSummaryField("netRevenue");
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
    private OrderEntity buildOrder(String status, String paymentStatus,
                                   String totalAmount, String refundAmount, Instant placedAt) {
        OrderEntity o = new OrderEntity();
        o.setOrderNumber("RPT-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        o.setStatus(status);
        o.setPaymentStatus(paymentStatus);
        o.setTotalAmount(new BigDecimal(totalAmount));
        o.setPaidAmount(new BigDecimal(totalAmount)); // default: all cash collected
        if (refundAmount != null) {
            o.setRefundAmount(new BigDecimal(refundAmount));
            o.setRefundedAt(placedAt);
        }
        o.setPlacedAt(placedAt);
        o.setCreatedAt(placedAt);
        o.setUpdatedAt(placedAt);
        return o;
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
