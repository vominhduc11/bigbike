package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerSessionJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
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

/**
 * Phase 1I.1 — Verifies that DISABLED/BLOCKED/PENDING customers cannot login
 * and that no session is created on rejected login.
 */
@SpringBootTest
class Phase1I1CustomerStatusLoginTest {

    private static final String ADMIN_EMAIL = "1i1-admin-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS  = "Admin@1I1Status!";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired CustomerJpaRepository customerRepo;
    @Autowired CustomerSessionJpaRepository sessionRepo;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired PasswordService passwordService;

    private MockMvc mockMvc;
    private String adminToken;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureAdminUser();
        adminToken = loginAdmin();
    }

    // ── 1. DISABLED customer is rejected ────────────────────────────────────

    @Test
    void login_disabledCustomer_rejected() throws Exception {
        String email = "dis-" + UUID.randomUUID() + "@bigbike.test";
        String password = "pass1234";
        registerCustomer(email, password);
        setCustomerStatus(email, "DISABLED");

        mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    // ── 2. BLOCKED customer is rejected ─────────────────────────────────────

    @Test
    void login_blockedCustomer_rejected() throws Exception {
        String email = "blk-" + UUID.randomUUID() + "@bigbike.test";
        String password = "pass1234";
        registerCustomer(email, password);
        setCustomerStatus(email, "BLOCKED");

        mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    // ── 3. PENDING customer is rejected ─────────────────────────────────────

    @Test
    void login_pendingCustomer_rejected() throws Exception {
        String email = "pnd-" + UUID.randomUUID() + "@bigbike.test";
        String password = "pass1234";
        registerCustomer(email, password);
        setCustomerStatus(email, "PENDING");

        mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    // ── 4. DISABLED customer login does not create a session ────────────────

    @Test
    void login_disabledCustomer_doesNotCreateSession() throws Exception {
        String email = "nosess-" + UUID.randomUUID() + "@bigbike.test";
        String password = "pass1234";
        registerCustomer(email, password);

        UUID customerId = customerRepo.findByEmail(email).orElseThrow().getId();
        long sessionsBefore = sessionRepo.findByCustomerId(customerId).stream()
                .filter(s -> "ACTIVE".equals(s.getStatus())).count();

        setCustomerStatus(email, "DISABLED");

        // Attempt login — must fail
        mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isUnauthorized());

        // No new active sessions should have been created
        long sessionsAfter = sessionRepo.findByCustomerId(customerId).stream()
                .filter(s -> "ACTIVE".equals(s.getStatus())).count();
        assertThat(sessionsAfter).isEqualTo(sessionsBefore);
    }

    // ── 5. ACTIVE customer can still login ───────────────────────────────────

    @Test
    void login_activeCustomer_stillWorks() throws Exception {
        String email = "act-" + UUID.randomUUID() + "@bigbike.test";
        String password = "pass1234";
        registerCustomer(email, password);
        // status is ACTIVE by default after register

        MvcResult result = mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.customer.email").value(email))
                .andReturn();

        // Session cookie must be set
        assertThat(getNamedCookie(result.getResponse(), "bb_session")).isNotNull();
    }

    // ── 6. Admin disables customer → subsequent login rejected ───────────────

    @Test
    void adminCanDisableCustomer_thenCustomerLoginRejected() throws Exception {
        String email = "adm-dis-" + UUID.randomUUID() + "@bigbike.test";
        String password = "pass5678";
        registerCustomer(email, password);

        // Confirm login works BEFORE disable
        mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk());

        // Find the customer UUID via admin list API
        MvcResult listResult = mockMvc.perform(get("/api/v1/admin/customers")
                        .param("q", email)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        String customerId = extractFirstId(listResult.getResponse().getContentAsString());
        assertThat(customerId).isNotNull();

        // Admin disables the customer
        mockMvc.perform(patch("/api/v1/admin/customers/" + customerId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DISABLED\",\"reason\":\"Test disable\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DISABLED"));

        // Login must now fail with 401
        mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    // ── 7. Error response does not leak account status ───────────────────────

    @Test
    void login_disabledCustomer_errorResponseDoesNotLeakStatus() throws Exception {
        String email = "noleak-" + UUID.randomUUID() + "@bigbike.test";
        String password = "pass1234";
        registerCustomer(email, password);
        setCustomerStatus(email, "DISABLED");

        MvcResult result = mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isUnauthorized())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        // Must not leak status-specific reasons
        assertThat(body).doesNotContainIgnoringCase("disabled");
        assertThat(body).doesNotContainIgnoringCase("blocked");
        assertThat(body).doesNotContainIgnoringCase("pending");
        assertThat(body).doesNotContainIgnoringCase("not active");
        assertThat(body).doesNotContainIgnoringCase("account status");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void registerCustomer(String email, String password) throws Exception {
        mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk());
    }

    /** Directly update status in DB — simulates an admin having called the status endpoint. */
    private void setCustomerStatus(String email, String status) {
        customerRepo.findByEmail(email).ifPresent(c -> {
            c.setStatus(status);
            c.setUpdatedAt(Instant.now());
            customerRepo.save(c);
        });
    }

    private void ensureAdminUser() {
        adminUserRepo.findByEmail(ADMIN_EMAIL).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(ADMIN_EMAIL);
            admin.setPasswordHash(passwordService.hash(ADMIN_PASS));
            admin.setDisplayName("Phase1I1 Test Admin");
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

    private jakarta.servlet.http.Cookie getNamedCookie(MockHttpServletResponse response, String name) {
        jakarta.servlet.http.Cookie[] cookies = response.getCookies();
        if (cookies == null) return null;
        for (jakarta.servlet.http.Cookie c : cookies) {
            if (name.equals(c.getName())) return c;
        }
        return null;
    }

    private String extractFirstId(String json) {
        String marker = "\"data\":[";
        int dataStart = json.indexOf(marker);
        if (dataStart < 0) return null;
        String marker2 = "\"id\":\"";
        int start = json.indexOf(marker2, dataStart);
        if (start < 0) return null;
        start += marker2.length();
        int end = json.indexOf("\"", start);
        return json.substring(start, end);
    }

    private String extractJsonValue(String json, String key) {
        String marker = "\"" + key + "\":\"";
        int start = json.indexOf(marker);
        if (start < 0) return null;
        start += marker.length();
        int end = json.indexOf("\"", start);
        return json.substring(start, end);
    }
}
