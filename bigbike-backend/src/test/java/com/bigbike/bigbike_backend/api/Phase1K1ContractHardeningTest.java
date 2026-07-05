package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminRoleEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminRoleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.menu.MenuItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.menu.MenuJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.service.auth.AdminPermissionService;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class Phase1K1ContractHardeningTest {

    private static final String ADMIN_EMAIL = "1k1-admin-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS  = "Admin@1K1Secure!";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired AdminRoleJpaRepository roleRepo;
    @Autowired AdminPermissionService adminPermissionService;
    @Autowired MenuJpaRepository menuRepo;
    @Autowired MenuItemJpaRepository menuItemRepo;
    @Autowired SiteSettingJpaRepository settingRepo;
    @Autowired PasswordService passwordService;

    private MockMvc mockMvc;
    private String adminToken;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders
                .webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureSuperAdminRole();
        ensureAdminUser();
        adminToken = loginAdmin();
    }

    // The test profile disables Flyway and uses ddl-auto=create-drop, so the role_permissions
    // seed never runs and the admin_roles table is empty. requirePermission() (JWT path) resolves
    // permissions from that table via AdminPermissionService, so without a seeded role every
    // permission-gated request 403s. Seed SUPER_ADMIN with the "*" wildcard for this test.
    private void ensureSuperAdminRole() {
        if (!roleRepo.existsById("SUPER_ADMIN")) {
            AdminRoleEntity role = new AdminRoleEntity();
            role.setId("SUPER_ADMIN");
            role.setName("Super Admin");
            role.setDescription("Phase1K1 hardening test role");
            role.setSystem(true);
            role.setPermissions(new LinkedHashSet<>(Set.of("*")));
            Instant now = Instant.now();
            role.setCreatedAt(now);
            role.setUpdatedAt(now);
            roleRepo.save(role);
        }
        adminPermissionService.evict("SUPER_ADMIN");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 3 — Menu deep parent-cycle: partial-change prevention
    // ══════════════════════════════════════════════════════════════════════════

    // Test: if a reorder payload forms a cycle, NO item should be modified.
    @Test
    void reorderMenuItems_invalidGraph_doesNotPersistPartialChanges() throws Exception {
        String location = "no-partial-" + UUID.randomUUID().toString().substring(0, 8);
        MenuEntity menu = createTestMenu(location, "No Partial Persist");
        MenuItemEntity itemA = createTestMenuItem(menu, "A", "/a", null, 0);
        MenuItemEntity itemB = createTestMenuItem(menu, "B", "/b", null, 1);
        MenuItemEntity itemC = createTestMenuItem(menu, "C", "/c", null, 2);

        // A→B, B→C, C→A = full 3-cycle; last entry creates cycle
        String body = """
                {"items":[
                  {"id":"%s","parentId":"%s","sortOrder":0},
                  {"id":"%s","parentId":"%s","sortOrder":1},
                  {"id":"%s","parentId":"%s","sortOrder":2}
                ]}
                """.formatted(
                itemA.getId(), itemB.getId(),
                itemB.getId(), itemC.getId(),
                itemC.getId(), itemA.getId()
        );

        // Must be rejected
        mockMvc.perform(post("/api/v1/admin/menus/" + menu.getId() + "/items/reorder")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());

        // Verify: none of A, B, C should have been persisted with new parentIds
        List<MenuItemEntity> afterItems = menuItemRepo.findByMenuId(menu.getId());
        for (MenuItemEntity item : afterItems) {
            assertThat(item.getParentId())
                    .as("parentId of %s should still be null after rejected reorder", item.getLabel())
                    .isNull();
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 4 — Settings sensitive key hardening (private_key, clientsecret)
    // ══════════════════════════════════════════════════════════════════════════

    // private_key in setting key → cannot be set public
    @Test
    void updateSetting_privateKeyCannotBePublic() throws Exception {
        String key = "stripe.private_key." + UUID.randomUUID().toString().substring(0, 6);
        createTestSetting(key, "pk_live_secret_value", "payment", false);

        mockMvc.perform(patch("/api/v1/admin/settings/" + key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isPublic\":true}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // clientsecret in setting key → cannot be set public
    @Test
    void updateSetting_clientsecretCannotBePublic() throws Exception {
        String key = "oauth.clientsecret." + UUID.randomUUID().toString().substring(0, 6);
        createTestSetting(key, "cs_super_private_value", "auth", false);

        mockMvc.perform(patch("/api/v1/admin/settings/" + key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isPublic\":true}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // Updating VALUE of a sensitive key (without touching isPublic) must succeed
    @Test
    void updateSetting_privateSensitiveValueCanStillBeUpdated() throws Exception {
        String key = "payment.private_key.upd." + UUID.randomUUID().toString().substring(0, 6);
        createTestSetting(key, "old_value", "payment", false);

        // Patch only the value — no isPublic change
        mockMvc.perform(patch("/api/v1/admin/settings/" + key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"new_rotated_value\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.settingKey").value(key));
    }

    // Public endpoint must never return settings whose keys are private/sensitive
    @Test
    void publicSettings_neverReturnsSensitivePrivateKeys() throws Exception {
        String sensitiveKey = "site.api_key.pub." + UUID.randomUUID().toString().substring(0, 6);
        // Create it as private (isPublic=false) — public endpoint must never return it
        createTestSetting(sensitiveKey, "ultra_secret_value", "internal", false);

        MvcResult result = mockMvc.perform(get("/api/v1/settings/public"))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).doesNotContain(sensitiveKey);
        assertThat(body).doesNotContain("ultra_secret_value");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 4b — product_assign_roles (dynamic assignment banner, V318)
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    void productAssignRoles_superAdminCanWriteValidPayload_andReadReflectsIt() throws Exception {
        createTestSetting("product_assign_title", "Phân công", "product_assign", false);
        createTestSetting("product_assign_roles", "[]", "product_assign", false);

        String rolesJson = "[{\"id\":\"content\",\"name\":\"Content\",\"items\":\"A · B\"},"
                + "{\"id\":\"warehouse\",\"name\":\"Kho vận\",\"items\":\"\"}]";
        String requestBody = "{\"value\":\"" + escapeForJsonString(rolesJson) + "\"}";

        mockMvc.perform(patch("/api/v1/admin/settings/product_assign_roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/admin/product-assignment")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roles.length()").value(2))
                .andExpect(jsonPath("$.data.roles[0].id").value("content"))
                .andExpect(jsonPath("$.data.roles[1].name").value("Kho vận"));
    }

    // Caller holds settings.write but NOT the wildcard '*' (not SUPER_ADMIN) → superAdminOnly gate rejects.
    @Test
    void productAssignRoles_nonSuperAdminWithSettingsWrite_getsForbidden() throws Exception {
        createTestSetting("product_assign_roles", "[]", "product_assign", false);
        String writerToken = createNonSuperAdminSettingsWriterToken();

        String requestBody = "{\"value\":\"" + escapeForJsonString(buildRoles(1)) + "\"}";

        mockMvc.perform(patch("/api/v1/admin/settings/product_assign_roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody)
                        .header("Authorization", "Bearer " + writerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void productAssignRoles_outOfRangeOrMalformedPayload_rejectedWith400() throws Exception {
        createTestSetting("product_assign_roles", "[]", "product_assign", false);

        // 0 roles — below the 1-role minimum
        mockMvc.perform(patch("/api/v1/admin/settings/product_assign_roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"[]\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());

        // 7 roles — above the 6-role maximum
        String sevenRolesBody = "{\"value\":\"" + escapeForJsonString(buildRoles(7)) + "\"}";
        mockMvc.perform(patch("/api/v1/admin/settings/product_assign_roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(sevenRolesBody)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());

        // Malformed JSON
        mockMvc.perform(patch("/api/v1/admin/settings/product_assign_roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"not json\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 5 — OpenAPI static spec regression checks
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    void openApiDocsEndpoint_stillWorks() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk());
    }

    @Test
    void openApi_menuStatusDocumentsActiveInactive() throws Exception {
        MvcResult result = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn();
        String body = result.getResponse().getContentAsString();
        // Menu status enum must document ACTIVE and INACTIVE
        assertThat(body).contains("\"ACTIVE\"");
        assertThat(body).contains("\"INACTIVE\"");
    }

    @Test
    void openApi_stillDoesNotExposePasswordHash() throws Exception {
        MvcResult result = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("passwordHash");
    }

    @Test
    void openApi_stillDoesNotExposeStorageSecrets() throws Exception {
        MvcResult result = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn();
        String body = result.getResponse().getContentAsString();
        assertThat(body).doesNotContain("storageBucket");
        assertThat(body).doesNotContain("\"bucket\"");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 5 — (removed) Missing-required-request-parameter coverage previously
    // exercised the POS product-search endpoint, which was deleted when the POS
    // feature was removed (owner decision 2026-06-23: online-only). No other admin
    // endpoint declares a required @RequestParam, so there is nothing to retarget.
    // ══════════════════════════════════════════════════════════════════════════

    // ══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    private void ensureAdminUser() {
        adminUserRepo.findByEmail(ADMIN_EMAIL).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(ADMIN_EMAIL);
            admin.setPasswordHash(passwordService.hash(ADMIN_PASS));
            admin.setDisplayName("Phase1K1 Test Admin");
            // Hardening tests exercise settings.write / menus.write validation paths; the seed
            // user must hold those permissions or requirePermission short-circuits with 403 before
            // the validation under test runs. SUPER_ADMIN carries the "*" wildcard (AdminRolePermissions).
            admin.setRole("SUPER_ADMIN");
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

    private SiteSettingEntity createTestSetting(String key, String value, String group, boolean isPublic) {
        return settingRepo.findBySettingKey(key).orElseGet(() -> {
            SiteSettingEntity s = new SiteSettingEntity();
            s.setSettingKey(key);
            s.setSettingValue(value);
            s.setSettingGroup(group);
            s.setPublic(isPublic);
            Instant now = Instant.now();
            s.setCreatedAt(now);
            s.setUpdatedAt(now);
            return settingRepo.save(s);
        });
    }

    private MenuEntity createTestMenu(String location, String name) {
        return menuRepo.findByLocation(location).orElseGet(() -> {
            MenuEntity m = new MenuEntity();
            m.setLocation(location);
            m.setName(name);
            m.setStatus("ACTIVE");
            Instant now = Instant.now();
            m.setCreatedAt(now);
            m.setUpdatedAt(now);
            return menuRepo.save(m);
        });
    }

    private MenuItemEntity createTestMenuItem(MenuEntity menu, String label, String url,
            UUID parentId, int sortOrder) {
        MenuItemEntity i = new MenuItemEntity();
        i.setMenu(menu);
        i.setLabel(label);
        i.setUrl(url);
        i.setParentId(parentId);
        i.setSortOrder(sortOrder);
        i.setOpenInNewTab(false);
        i.setStatus("ACTIVE");
        Instant now = Instant.now();
        i.setCreatedAt(now);
        i.setUpdatedAt(now);
        return menuItemRepo.save(i);
    }

    // Creates (or reuses) a non-system role holding settings.write but NOT the wildcard '*',
    // an admin user assigned to it, and returns a login token — used to prove the
    // product_assign_* superAdminOnly gate blocks a caller that has settings.write but isn't
    // SUPER_ADMIN, mirroring ensureSuperAdminRole/ensureAdminUser/loginAdmin above for a 2nd identity.
    private String createNonSuperAdminSettingsWriterToken() throws Exception {
        String roleId = "SETTINGS_WRITER_TEST";
        if (!roleRepo.existsById(roleId)) {
            AdminRoleEntity role = new AdminRoleEntity();
            role.setId(roleId);
            role.setName("Settings Writer Test");
            role.setDescription("Phase1K1 hardening test role — settings.write without wildcard");
            role.setSystem(false);
            role.setPermissions(new LinkedHashSet<>(Set.of("settings.write", "settings.read", "products.read")));
            Instant now = Instant.now();
            role.setCreatedAt(now);
            role.setUpdatedAt(now);
            roleRepo.save(role);
        }
        adminPermissionService.evict(roleId);

        String email = "1k1-settings-writer-" + UUID.randomUUID() + "@bigbike.test";
        String password = "Writer@1K1Secure!";
        adminUserRepo.findByEmail(email).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(email);
            admin.setPasswordHash(passwordService.hash(password));
            admin.setDisplayName("Phase1K1 Settings Writer");
            admin.setRole(roleId);
            admin.setStatus("ACTIVE");
            Instant now = Instant.now();
            admin.setCreatedAt(now);
            admin.setUpdatedAt(now);
            return adminUserRepo.save(admin);
        });

        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return extractJsonValue(result.getResponse().getContentAsString(), "accessToken");
    }

    // Builds a JSON array of `count` distinct {id,name,items} role objects — used to probe the
    // 1-6 product_assign_roles size limit without hand-writing a literal 7-role JSON string.
    private static String buildRoles(int count) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < count; i++) {
            if (i > 0) sb.append(",");
            sb.append("{\"id\":\"r").append(i).append("\",\"name\":\"R").append(i).append("\",\"items\":\"\"}");
        }
        return sb.append("]").toString();
    }

    // Escapes a JSON string so it can be embedded as the value of an outer JSON string field —
    // product_assign_roles' setting_value IS a JSON array, so writing it via
    // PATCH /admin/settings/{key} means nesting JSON-as-a-string inside the request body's own JSON.
    private static String escapeForJsonString(String raw) {
        return raw.replace("\\", "\\\\").replace("\"", "\\\"");
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
