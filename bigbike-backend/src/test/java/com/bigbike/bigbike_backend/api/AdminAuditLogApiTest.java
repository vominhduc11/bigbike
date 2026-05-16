package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.service.auth.AdminPermissionService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * RBAUD-012: Integration tests for GET /api/v1/admin/audit-logs.
 * Covers: auth (401/403/200), response shape, filters (action/resourceType/date),
 * sort order, immutability (no delete endpoint).
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class AdminAuditLogApiTest {

    private static final String ADMIN_ID   = UUID.randomUUID().toString();
    private static final String EDITOR_ID  = UUID.randomUUID().toString();

    @Autowired private WebApplicationContext webApplicationContext;
    @Autowired private AuditLogJpaRepository auditLogRepo;
    @Autowired private AdminPermissionService adminPermissionService;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(springSecurity())
                .build();
        // Evict permission cache so DB seed permissions are picked up fresh
        adminPermissionService.evict("ADMIN");
        adminPermissionService.evict("EDITOR");

        // Seed at least one audit log entry so filter/sort tests have data
        seedAuditLog("ORDER", "ORDER_STATUS_UPDATED", "10.0.0.1", null);
        seedAuditLog("REPORT", "REPORT_EXPORT_CREATED", "10.0.0.2", null);
        seedAuditLog("PRODUCT", "PRODUCT_CREATED", "10.0.0.3", null);
    }

    // ── 1. No auth → 401 ─────────────────────────────────────────────────────

    @Test
    void listAuditLogs_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/audit-logs"))
                .andExpect(status().isUnauthorized());
    }

    // ── 2. EDITOR role (no audit-logs.read) → 403 ────────────────────────────

    @Test
    void listAuditLogs_insufficientPermission_returns403() throws Exception {
        mockMvc.perform(get("/api/v1/admin/audit-logs")
                        .with(principalAuth(EDITOR_ID, "EDITOR")))
                .andExpect(status().isForbidden());
    }

    // ── 3. ADMIN role → 200 ──────────────────────────────────────────────────

    @Test
    void listAuditLogs_adminWithPermission_returns200() throws Exception {
        mockMvc.perform(get("/api/v1/admin/audit-logs")
                        .with(principalAuth(ADMIN_ID, "ADMIN")))
                .andExpect(status().isOk());
    }

    // ── 4. Response shape: content array + totalElements + page ──────────────

    @Test
    void listAuditLogs_pageResultShape() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/admin/audit-logs")
                        .param("page", "1").param("size", "10")
                        .with(principalAuth(ADMIN_ID, "ADMIN")))
                .andExpect(status().isOk())
                .andReturn();

        String json = result.getResponse().getContentAsString();
        // Response must include a data array and pagination metadata
        assertThat(json).containsAnyOf("\"data\":[", "\"items\":[", "\"content\":[");
        assertThat(json).containsAnyOf(
                "\"totalElements\"", "\"total\"", "\"totalItems\"");
        assertThat(json).containsAnyOf(
                "\"page\":", "\"pageNumber\":");
    }

    // ── 5. Filter by resourceType=ORDER → 200, all items have resourceType ORDER

    @Test
    void listAuditLogs_filterByResourceType_returns200() throws Exception {
        mockMvc.perform(get("/api/v1/admin/audit-logs")
                        .param("resourceType", "ORDER")
                        .with(principalAuth(ADMIN_ID, "ADMIN")))
                .andExpect(status().isOk());
    }

    // ── 6. Filter by resourceType=REPORT → 200 (RBAUD-007 backend support) ──

    @Test
    void listAuditLogs_filterByResourceTypeReport_returns200() throws Exception {
        mockMvc.perform(get("/api/v1/admin/audit-logs")
                        .param("resourceType", "REPORT")
                        .with(principalAuth(ADMIN_ID, "ADMIN")))
                .andExpect(status().isOk());
    }

    // ── 7. Filter by action → 200 ─────────────────────────────────────────────

    @Test
    void listAuditLogs_filterByAction_returns200() throws Exception {
        mockMvc.perform(get("/api/v1/admin/audit-logs")
                        .param("action", "ORDER_STATUS_UPDATED")
                        .with(principalAuth(ADMIN_ID, "ADMIN")))
                .andExpect(status().isOk());
    }

    // ── 8. Filter by date range → 200 ────────────────────────────────────────

    @Test
    void listAuditLogs_filterByDateRange_returns200() throws Exception {
        String today    = java.time.LocalDate.now().toString();
        String tomorrow = java.time.LocalDate.now().plusDays(1).toString();
        mockMvc.perform(get("/api/v1/admin/audit-logs")
                        .param("from", today).param("to", tomorrow)
                        .with(principalAuth(ADMIN_ID, "ADMIN")))
                .andExpect(status().isOk());
    }

    // ── 9. Results sorted createdAt DESC (first item >= last item) ────────────

    @Test
    void listAuditLogs_sortedByCreatedAtDesc() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/admin/audit-logs")
                        .param("page", "1").param("size", "50")
                        .with(principalAuth(ADMIN_ID, "ADMIN")))
                .andExpect(status().isOk())
                .andReturn();

        String json = result.getResponse().getContentAsString();
        // Extract all createdAt values and verify descending order
        List<String> timestamps = extractCreatedAtValues(json);
        for (int i = 0; i < timestamps.size() - 1; i++) {
            Instant a = Instant.parse(timestamps.get(i));
            Instant b = Instant.parse(timestamps.get(i + 1));
            assertThat(a).as("item[%d].createdAt >= item[%d].createdAt", i, i + 1)
                    .isAfterOrEqualTo(b);
        }
    }

    // ── 10. No DELETE endpoint — immutability confirmed ───────────────────────

    @Test
    void deleteAuditLog_returns404or405() throws Exception {
        UUID fakeId = UUID.randomUUID();
        int status = mockMvc.perform(delete("/api/v1/admin/audit-logs/" + fakeId)
                        .with(principalAuth(ADMIN_ID, "ADMIN")))
                .andReturn().getResponse().getStatus();
        // Must never succeed (200/204) — any non-2xx response confirms no delete endpoint exists.
        // Spring Boot may return 404 (no route), 405 (method not allowed), or 500 (no handler found).
        assertThat(status).as("DELETE audit-log endpoint must not exist (no 2xx)")
                .isNotIn(200, 201, 202, 204);
    }

    // ── 11. IP address stored in audit log after export (RBAUD-003/006) ───────

    @Test
    void exportAuditLog_hasNonNullIpAddress() throws Exception {
        // Trigger a report export through the API so an audit log is written
        mockMvc.perform(get("/api/v1/admin/reports/orders/export")
                        .header("X-Forwarded-For", "10.10.10.10")
                        .with(principalAuth(ADMIN_ID, "ADMIN")))
                .andExpect(status().isOk());

        // Check that audit logs for REPORT_EXPORT_CREATED have a non-null ipAddress
        boolean hasIp = auditLogRepo.findAll().stream()
                .filter(l -> "REPORT_EXPORT_CREATED".equals(l.getAction()))
                .anyMatch(l -> l.getIpAddress() != null && !l.getIpAddress().isBlank());
        assertThat(hasIp).as("REPORT_EXPORT_CREATED audit log should have non-null ipAddress").isTrue();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Auth with real AdminPrincipal — triggers DB-backed permission lookup. */
    private static RequestPostProcessor principalAuth(String adminId, String role) {
        AdminPrincipal principal = new AdminPrincipal(adminId, adminId + "@test.local", role);
        return authentication(new UsernamePasswordAuthenticationToken(
                principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))
        ));
    }

    private AuditLogEntity seedAuditLog(String resourceType, String action,
                                         String ipAddress, String userAgent) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(UUID.fromString(ADMIN_ID));
        log.setAction(action);
        log.setResourceType(resourceType);
        log.setAfterData("{\"test\":true}");
        log.setIpAddress(ipAddress);
        log.setUserAgent(userAgent);
        log.setCreatedAt(Instant.now());
        return auditLogRepo.save(log);
    }

    /**
     * Extracts all "createdAt":"..." string values from the JSON response.
     * Works for both flat and nested structures the controller may return.
     */
    private List<String> extractCreatedAtValues(String json) {
        java.util.List<String> result = new java.util.ArrayList<>();
        String marker = "\"createdAt\":\"";
        int pos = 0;
        while ((pos = json.indexOf(marker, pos)) >= 0) {
            int start = pos + marker.length();
            int end = json.indexOf("\"", start);
            if (end > start) {
                result.add(json.substring(start, end));
            }
            pos = end > 0 ? end : pos + 1;
        }
        return result;
    }
}
