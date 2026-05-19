package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminRoleEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminRoleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.service.auth.AdminPermissionService;
import com.bigbike.bigbike_backend.service.auth.JwtService;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
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

/**
 * Integration tests for P0 RBAC URL-gate fix.
 *
 * Verifies that:
 * (a) Custom roles with specific permissions can reach the corresponding admin endpoints.
 * (b) Roles without a required permission receive 403 from the controller, not the URL gate.
 * (c) Standard content-management roles (EDITOR) are no longer blocked at the URL level.
 * (d) A JWT with CUSTOMER role cannot access admin resources (no permissions → 403).
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class RbacUrlGateIntegrationTest {

    // Custom role IDs — unique per test run to avoid inter-test collisions
    private static final String ROLE_POS_READER    = "RBAC_TEST_POS_READER";
    private static final String ROLE_COUPON_READER = "RBAC_TEST_COUPON_READER";
    private static final String ROLE_ORDER_READER  = "RBAC_TEST_ORDER_READER";

    private static final String POS_READER_EMAIL    = "rbac-pos-"    + UUID.randomUUID() + "@bigbike.test";
    private static final String COUPON_READER_EMAIL = "rbac-coupon-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ORDER_READER_EMAIL  = "rbac-order-"  + UUID.randomUUID() + "@bigbike.test";
    private static final String EDITOR_EMAIL        = "rbac-editor-" + UUID.randomUUID() + "@bigbike.test";

    private static final String TEST_PASS = "Rbac@Test1234";

    @Autowired WebApplicationContext wac;
    @Autowired AdminRoleJpaRepository roleRepo;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired PasswordService passwordService;
    @Autowired JwtService jwtService;
    @Autowired AdminPermissionService adminPermissionService;

    private MockMvc mockMvc;

    private String posReaderToken;
    private String couponReaderToken;
    private String orderReaderToken;
    private String editorToken;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();

        ensureRole(ROLE_POS_READER,    "RBAC Test POS Reader",    Set.of("pos.read"));
        ensureRole(ROLE_COUPON_READER, "RBAC Test Coupon Reader", Set.of("coupons.read"));
        ensureRole(ROLE_ORDER_READER,  "RBAC Test Order Reader",  Set.of("orders.read"));
        // EDITOR is a built-in role seeded by Flyway V49, but tests run against H2 with Flyway
        // disabled (create-drop schema only). Seed EDITOR explicitly so DB matches the static map.
        ensureRole("EDITOR", "Editor", Set.of(
                "products.read", "catalog.read",
                "content.read", "content.update",
                "media.read", "media.write",
                "menus.read", "menus.write",
                "sliders.read", "sliders.write"));

        ensureUser(POS_READER_EMAIL,    ROLE_POS_READER);
        ensureUser(COUPON_READER_EMAIL, ROLE_COUPON_READER);
        ensureUser(ORDER_READER_EMAIL,  ROLE_ORDER_READER);
        ensureUser(EDITOR_EMAIL,        "EDITOR");

        posReaderToken    = login(POS_READER_EMAIL);
        couponReaderToken = login(COUPON_READER_EMAIL);
        orderReaderToken  = login(ORDER_READER_EMAIL);
        editorToken       = login(EDITOR_EMAIL);
    }

    // ── 1. Custom role with pos.read → POS search succeeds ───────────────────

    @Test
    void customRole_posRead_canCallPosSearch() throws Exception {
        mockMvc.perform(get("/api/v1/admin/pos/products/search")
                        .param("q", "rbac-test-" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + posReaderToken))
                .andExpect(status().isOk());
    }

    // ── 2. Custom role without pos.write → POS mutation is 403 ───────────────

    @Test
    void customRole_noPosWrite_posOrderReturns403() throws Exception {
        // Permission check fires first, before business logic — 403 regardless of body validity
        mockMvc.perform(post("/api/v1/admin/pos/orders")
                        .header("Authorization", "Bearer " + posReaderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"CASH\",\"posIdempotencyKey\":\""
                                + UUID.randomUUID() + "\",\"tenderedAmount\":9999999,\"items\":[]}"))
                .andExpect(status().isForbidden());
    }

    // ── 3. Custom role with coupons.read → coupon list succeeds ──────────────

    @Test
    void customRole_couponsRead_canCallCouponsList() throws Exception {
        mockMvc.perform(get("/api/v1/admin/coupons")
                        .header("Authorization", "Bearer " + couponReaderToken))
                .andExpect(status().isOk());
    }

    // ── 4. Custom role with orders.read → dashboard succeeds ─────────────────

    @Test
    void customRole_ordersRead_canCallDashboard() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dashboard")
                        .header("Authorization", "Bearer " + orderReaderToken))
                .andExpect(status().isOk());
    }

    // ── 5a. EDITOR (products.read) → product list no longer blocked ──────────

    @Test
    void editor_notBlockedByUrlGate_productsListAccessible() throws Exception {
        // Before fix: EDITOR got 403 at URL gate (hasRole("ADMIN") catch-all).
        // After fix: URL gate is authenticated(); EDITOR passes because they have products.read.
        mockMvc.perform(get("/api/v1/admin/products")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk());
    }

    // ── 5b. EDITOR (content.read) → content reference endpoint accessible ────

    @Test
    void editor_contentReadEndpointAccessible() throws Exception {
        mockMvc.perform(get("/api/v1/admin/content/reference/authors")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk());
    }

    // ── 6. JWT with CUSTOMER role → admin endpoint returns 403 ───────────────

    @Test
    void customerJwt_adminEndpointReturns403() throws Exception {
        // A JWT bearing role "CUSTOMER" passes the authenticated() URL gate but
        // adminPermissionService.getPermissionsForRole("CUSTOMER") returns empty
        // (CUSTOMER is not a row in admin_roles), so requirePermission() throws 403.
        String customerJwt = jwtService.generateAccessToken(
                "customer-test-id", "customer@bigbike.test", "CUSTOMER");
        mockMvc.perform(get("/api/v1/admin/products")
                        .header("Authorization", "Bearer " + customerJwt))
                .andExpect(status().isForbidden());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void ensureRole(String id, String name, Set<String> permissions) {
        if (roleRepo.existsById(id)) {
            // Evict stale cache entry so DB state is authoritative for this test run
            adminPermissionService.evict(id);
            return;
        }
        AdminRoleEntity role = new AdminRoleEntity();
        role.setId(id);
        role.setName(name);
        role.setDescription("RBAC integration test role");
        role.setSystem(false);
        role.setPermissions(new LinkedHashSet<>(permissions));
        Instant now = Instant.now();
        role.setCreatedAt(now);
        role.setUpdatedAt(now);
        roleRepo.save(role);
        adminPermissionService.evict(id);
    }

    private void ensureUser(String email, String role) {
        adminUserRepo.findByEmail(email).orElseGet(() -> {
            AdminUserEntity u = new AdminUserEntity();
            u.setEmail(email);
            u.setPasswordHash(passwordService.hash(TEST_PASS));
            u.setDisplayName("RBAC Test " + role);
            u.setRole(role);
            u.setStatus("ACTIVE");
            Instant now = Instant.now();
            u.setCreatedAt(now);
            u.setUpdatedAt(now);
            return adminUserRepo.save(u);
        });
    }

    private String login(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + TEST_PASS + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String json = result.getResponse().getContentAsString();
        String marker = "\"accessToken\":\"";
        int start = json.indexOf(marker) + marker.length();
        return json.substring(start, json.indexOf("\"", start));
    }

    // ── PublicCacheHeaderFilter — public catalog GETs are CDN/browser cacheable ───
    // Public, non-personalised reads must be cacheable; everything else must keep
    // Spring Security's no-store so personalised responses never reach a CDN.

    @Test
    void publicCatalogGet_isBrowserCacheable() throws Exception {
        mockMvc.perform(get("/api/v1/products"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .header().string("Cache-Control", "public, max-age=60"));
    }

    @Test
    void adminGet_staysNoStore_notCacheable() throws Exception {
        // Admin endpoint reached with a valid token — response must NOT be cacheable.
        String token = login(POS_READER_EMAIL);
        mockMvc.perform(get("/api/v1/admin/pos/products/search").param("q", "x")
                        .header("Authorization", "Bearer " + token))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .header().string("Cache-Control",
                                org.hamcrest.Matchers.containsString("no-store")));
    }

    @Test
    void cartGet_staysNoStore_notCacheable() throws Exception {
        // Cart is guest/customer-specific — must never be served from a shared cache.
        mockMvc.perform(get("/api/v1/cart"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .header().string("Cache-Control",
                                org.hamcrest.Matchers.containsString("no-store")));
    }
}
