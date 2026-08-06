package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminRoleEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.maintenance.MaintenanceStateEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminRoleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.maintenance.MaintenanceStateJpaRepository;
import com.bigbike.bigbike_backend.service.auth.AdminPermissionService;
import com.bigbike.bigbike_backend.service.auth.JwtService;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import com.bigbike.bigbike_backend.service.maintenance.MaintenanceService;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
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
 * Admin maintenance lock — end-to-end through the real Spring Security filter chain.
 *
 * <p>{@code .apply(springSecurity())} is mandatory here: {@code MaintenanceWriteLockFilter} lives
 * in that chain, so a MockMvc built without it (the {@code X-Admin-Permissions} header style used
 * by {@code AdminReadApiTest}) would pass even with the filter completely broken.
 *
 * <p>Flyway is disabled under H2, so V374's seed row and DEVELOPER role do not exist — both are
 * created here by hand.
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class MaintenanceLockIntegrationTest {

    // Deliberately NOT reusing ADMIN / EDITOR: this class runs in the same JVM and H2 database
    // as every other test, so overwriting a shared built-in role's permission set would strip
    // permissions out from under unrelated suites. DEVELOPER and SUPER_ADMIN are created only
    // when absent, for the same reason.
    private static final String ROLE_STAFF = "MAINT_TEST_STAFF";
    private static final String ROLE_VIEWER = "MAINT_TEST_VIEWER";

    private static final String DEVELOPER_EMAIL = "maint-dev-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_EMAIL = "maint-admin-" + UUID.randomUUID() + "@bigbike.test";
    private static final String SUPER_EMAIL = "maint-super-" + UUID.randomUUID() + "@bigbike.test";
    private static final String EDITOR_EMAIL = "maint-editor-" + UUID.randomUUID() + "@bigbike.test";
    private static final String TEST_PASS = "Maint@Test1234";

    /** Any admin write works as the probe; a soft-delete on a random id is 404 when unlocked. */
    private static final String WRITE_PATH = "/api/v1/admin/products/" + UUID.randomUUID();
    private static final String MAINTENANCE_PATH = "/api/v1/admin/maintenance";

    @Autowired WebApplicationContext wac;
    @Autowired AdminRoleJpaRepository roleRepo;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired MaintenanceStateJpaRepository stateRepo;
    @Autowired MaintenanceService maintenanceService;
    @Autowired PasswordService passwordService;
    @Autowired JwtService jwtService;
    @Autowired AdminPermissionService adminPermissionService;
    @Autowired com.bigbike.bigbike_backend.service.admin.AdminRoleService adminRoleService;

    private MockMvc mockMvc;
    private String developerToken;
    private String adminToken;
    private String superToken;
    private String editorToken;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();

        // The gate compares the literal role name, so DEVELOPER must be the real thing.
        // maintenance.manage is what the endpoint now authenticates against (V375).
        ensureRoleIfAbsent("DEVELOPER", Set.of("maintenance.manage",
                "settings.read", "settings.write", "products.read", "products.update"));
        ensureRoleIfAbsent("SUPER_ADMIN", Set.of("*"));
        ensureRole(ROLE_STAFF, Set.of("settings.read", "settings.write", "products.read", "products.update"));
        ensureRole(ROLE_VIEWER, Set.of("content.read"));

        ensureUser(DEVELOPER_EMAIL, "DEVELOPER");
        ensureUser(ADMIN_EMAIL, ROLE_STAFF);
        ensureUser(SUPER_EMAIL, "SUPER_ADMIN");
        ensureUser(EDITOR_EMAIL, ROLE_VIEWER);

        developerToken = login(DEVELOPER_EMAIL);
        adminToken = login(ADMIN_EMAIL);
        superToken = login(SUPER_EMAIL);
        editorToken = login(EDITOR_EMAIL);

        setState(MaintenanceService.STATE_NORMAL);
    }

    @AfterEach
    void reset() {
        setState(MaintenanceService.STATE_NORMAL);
    }

    // ── The lock itself ───────────────────────────────────────────────────────

    @Test
    void activeLock_rejectsAdminWrite_with423AndMachineReadableCode() throws Exception {
        setState(MaintenanceService.STATE_ACTIVE);

        mockMvc.perform(delete(WRITE_PATH).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isLocked())
                .andExpect(jsonPath("$.error.code").value("MAINTENANCE_ACTIVE"));
    }

    /**
     * 423 rather than 503 is load-bearing: {@code deploy/nginx/api.bigbike.vn.conf} declares
     * {@code error_page 502 503 504} with {@code proxy_intercept_errors on}, so nginx would
     * replace a 503 body with its static outage JSON and the admin would never see the code.
     */
    @Test
    void activeLock_neverUses503_soNginxCannotSwallowTheBody() throws Exception {
        setState(MaintenanceService.STATE_ACTIVE);

        MvcResult result = mockMvc.perform(delete(WRITE_PATH)
                        .header("Authorization", "Bearer " + adminToken))
                .andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(423);
    }

    @Test
    void activeLock_leavesAdminReadsWorking() throws Exception {
        setState(MaintenanceService.STATE_ACTIVE);

        mockMvc.perform(get("/api/v1/admin/products").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    @Test
    void activeLock_stillReturns401ForAnUnauthenticatedWrite() throws Exception {
        setState(MaintenanceService.STATE_ACTIVE);

        // The filter runs before Spring Security's AuthorizationFilter, so it must pass
        // principal-less requests through or it would mask the auth contract.
        mockMvc.perform(delete(WRITE_PATH))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void activeLock_doesNotBlockTheDeveloperWhoOwnsIt() throws Exception {
        setState(MaintenanceService.STATE_ACTIVE);

        MvcResult result = mockMvc.perform(delete(WRITE_PATH)
                        .header("Authorization", "Bearer " + developerToken))
                .andReturn();

        assertThat(result.getResponse().getStatus()).isNotEqualTo(423);
    }

    @Test
    void activeLock_allowsReadShapedPostsThatPersistNothing() throws Exception {
        setState(MaintenanceService.STATE_ACTIVE);

        for (String path : new String[]{
                "/api/v1/admin/products/preview",
                "/api/v1/admin/categories/permanent-delete-impact",
                "/api/v1/admin/content/articles/preview"}) {
            MvcResult result = mockMvc.perform(post(path)
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andReturn();
            assertThat(result.getResponse().getStatus())
                    .as("read-shaped POST %s must not be locked out", path)
                    .isNotEqualTo(423);
        }
    }

    /** UPCOMING only warns staff; blocking there would make the warning pointless. */
    @Test
    void upcomingState_doesNotBlockWrites() throws Exception {
        setState(MaintenanceService.STATE_UPCOMING);

        MvcResult result = mockMvc.perform(delete(WRITE_PATH)
                        .header("Authorization", "Bearer " + adminToken))
                .andReturn();

        assertThat(result.getResponse().getStatus()).isNotEqualTo(423);
    }

    @Test
    void normalState_doesNotBlockWrites() throws Exception {
        MvcResult result = mockMvc.perform(delete(WRITE_PATH)
                        .header("Authorization", "Bearer " + adminToken))
                .andReturn();

        assertThat(result.getResponse().getStatus()).isNotEqualTo(423);
    }

    @Test
    void unlockRoundTrip_restoresAdminWritesAndInvalidatesTheCachedFlag() throws Exception {
        setState(MaintenanceService.STATE_ACTIVE);
        mockMvc.perform(delete(WRITE_PATH).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isLocked());

        mockMvc.perform(put(MAINTENANCE_PATH)
                        .header("Authorization", "Bearer " + developerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"state\":\"NORMAL\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("NORMAL"));

        MvcResult after = mockMvc.perform(delete(WRITE_PATH)
                        .header("Authorization", "Bearer " + adminToken))
                .andReturn();
        assertThat(after.getResponse().getStatus()).isNotEqualTo(423);
    }

    // ── Who may toggle ────────────────────────────────────────────────────────

    /**
     * The single most important assertion in this change.
     *
     * <p>{@code DevAdminAuthService.hasAnyPermission} returns true unconditionally for any role
     * holding {@code "*"}, so SUPER_ADMIN automatically holds every permission that could be
     * invented for this endpoint. The owner's 2026-08-06 decision is that SUPER_ADMIN must NOT be
     * able to toggle the lock — only the exact role-name check keeps that true. If this test ever
     * goes red, the gate has silently reverted to a permission check.
     */
    @Test
    void superAdmin_cannotToggleMaintenance_despiteHoldingWildcard() throws Exception {
        mockMvc.perform(put(MAINTENANCE_PATH)
                        .header("Authorization", "Bearer " + superToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"state\":\"ACTIVE\"}"))
                .andExpect(status().isForbidden());

        assertThat(maintenanceService.getStatus().state()).isEqualTo(MaintenanceService.STATE_NORMAL);
    }

    @Test
    void superAdmin_seesStatusButCanToggleIsFalse() throws Exception {
        mockMvc.perform(get(MAINTENANCE_PATH).header("Authorization", "Bearer " + superToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.canToggle").value(false));
    }

    @Test
    void developer_seesCanToggleTrue() throws Exception {
        mockMvc.perform(get(MAINTENANCE_PATH).header("Authorization", "Bearer " + developerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.canToggle").value(true));
    }

    /** Every staff member must be able to see why the panel is locked. */
    @Test
    void editorWithoutSettingsPermission_canStillReadStatus() throws Exception {
        mockMvc.perform(get(MAINTENANCE_PATH).header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.canToggle").value(false));
    }

    @Test
    void editor_cannotToggleMaintenance() throws Exception {
        mockMvc.perform(put(MAINTENANCE_PATH)
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"state\":\"ACTIVE\"}"))
                .andExpect(status().isForbidden());
    }

    /**
     * The DEVELOPER role's permissions are what let a developer release the lock, so they must not
     * be editable — un-ticking {@code maintenance.manage} in the Roles screen would otherwise leave
     * the panel lockable but not unlockable, with nothing in the UI hinting at the connection.
     */
    @Test
    void theDeveloperRolePermissionsCannotBeEdited() {
        assertThatThrownBy(() -> adminRoleService.updateRolePermissions(
                        "DEVELOPER", Set.of("settings.read"), null, null, null))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("DEVELOPER");
    }

    @Test
    void superAdminRolePermissionsRemainLockedToo() {
        assertThatThrownBy(() -> adminRoleService.updateRolePermissions(
                        "SUPER_ADMIN", Set.of("settings.read"), null, null, null))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void developer_cannotSetAnUnknownState() throws Exception {
        mockMvc.perform(put(MAINTENANCE_PATH)
                        .header("Authorization", "Bearer " + developerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"state\":\"BOGUS\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void developer_canRecordAStaffNoteWithTheState() throws Exception {
        mockMvc.perform(put(MAINTENANCE_PATH)
                        .header("Authorization", "Bearer " + developerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"state\":\"UPCOMING\",\"staffNote\":\"Nâng cấp dữ liệu sản phẩm\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("UPCOMING"))
                .andExpect(jsonPath("$.data.staffNote").value("Nâng cấp dữ liệu sản phẩm"));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void setState(String state) {
        MaintenanceStateEntity entity = stateRepo.findById(MaintenanceStateEntity.SINGLETON_ID)
                .orElseGet(MaintenanceStateEntity::new);
        entity.setId(MaintenanceStateEntity.SINGLETON_ID);
        entity.setState(state);
        entity.setUpdatedAt(Instant.now());
        stateRepo.save(entity);
        // Written behind the service's back, so drop its short-TTL cache explicitly.
        maintenanceService.invalidateCache();
    }

    /** Creates the role only when missing — never rewrites a role other suites depend on. */
    private void ensureRoleIfAbsent(String id, Set<String> permissions) {
        if (roleRepo.existsById(id)) return;
        ensureRole(id, permissions);
    }

    private void ensureRole(String id, Set<String> permissions) {
        AdminRoleEntity role = roleRepo.findById(id).orElseGet(AdminRoleEntity::new);
        role.setId(id);
        role.setName(id);
        role.setDescription("Maintenance integration test role");
        role.setSystem(false);
        role.setPermissions(new LinkedHashSet<>(permissions));
        Instant now = Instant.now();
        if (role.getCreatedAt() == null) role.setCreatedAt(now);
        role.setUpdatedAt(now);
        roleRepo.save(role);
        adminPermissionService.evict(id);
    }

    private void ensureUser(String email, String role) {
        adminUserRepo.findByEmail(email).orElseGet(() -> {
            AdminUserEntity u = new AdminUserEntity();
            u.setEmail(email);
            u.setPasswordHash(passwordService.hash(TEST_PASS));
            u.setDisplayName("Maintenance Test " + role);
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
}
