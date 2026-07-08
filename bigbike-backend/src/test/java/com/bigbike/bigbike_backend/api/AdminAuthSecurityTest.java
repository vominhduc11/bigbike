package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.service.auth.JwtService;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Verifies that Spring Security correctly enforces authentication on protected endpoints
 * and allows access to public endpoints without any token.
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class AdminAuthSecurityTest {

    private MockMvc mockMvc;

    @Autowired private WebApplicationContext webApplicationContext;
    @Autowired private JwtService jwtService;
    @Autowired private AdminUserJpaRepository adminUserRepo;

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
    }

    /**
     * JwtAuthFilter re-checks the admin's current status/role against the DB on every request
     * (fixed 2026-07-06, audit IV-01) — a JWT for a non-existent user id is no longer trusted on
     * claims alone, so tests need a real ACTIVE admin_users row behind the token's subject.
     */
    private String createActiveAdminAndToken(String email, String role) {
        Instant now = Instant.now();
        AdminUserEntity admin = new AdminUserEntity();
        admin.setEmail(email);
        admin.setDisplayName("Security Test Admin");
        admin.setRole(role);
        admin.setStatus("ACTIVE");
        admin.setCreatedAt(now);
        admin.setUpdatedAt(now);
        AdminUserEntity saved = adminUserRepo.save(admin);
        return jwtService.generateAccessToken(saved.getId().toString(), email, role);
    }

    // ── Admin endpoints require ROLE_ADMIN ───────────────────────────────────

    @Test
    void adminEndpointWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/products"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    void adminEndpointWithValidAdminTokenReturns200() throws Exception {
        String token = createActiveAdminAndToken("sec-test@bigbike.test", "ADMIN");

        mockMvc.perform(get("/api/v1/admin/products")
                        .header("Authorization", "Bearer " + token)
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isOk());
    }

    @Test
    void adminEndpointWithExpiredTokenReturns401() throws Exception {
        // An obviously invalid/garbage token
        mockMvc.perform(get("/api/v1/admin/products")
                        .header("Authorization", "Bearer not.a.real.token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    // ── /auth/me requires authenticated user ─────────────────────────────────

    @Test
    void getMeWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    // ── Public catalog/content reads remain open ─────────────────────────────

    @Test
    void publicProductListIsAccessibleWithoutToken() throws Exception {
        mockMvc.perform(get("/api/v1/products").param("page", "1").param("size", "2"))
                .andExpect(status().isOk());
    }

    @Test
    void publicCategoryReadIsAccessibleWithoutToken() throws Exception {
        mockMvc.perform(get("/api/v1/categories/mu-bao-hiem"))
                .andExpect(status().isOk());
    }

    @Test
    void publicBrandReadIsAccessibleWithoutToken() throws Exception {
        mockMvc.perform(get("/api/v1/brands/ls2"))
                .andExpect(status().isOk());
    }

    // ── Auth login/refresh/logout are public ─────────────────────────────────

    @Test
    void loginEndpointIsPublic() throws Exception {
        // A malformed login request returns 400 (not 401) — proves the endpoint is reachable
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType("application/json")
                        .content("{\"email\":\"bad\",\"password\":\"\"}"))
                .andExpect(status().isBadRequest());
    }
}
