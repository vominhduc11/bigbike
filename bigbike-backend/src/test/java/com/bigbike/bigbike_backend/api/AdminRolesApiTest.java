package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminRoleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
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
class AdminRolesApiTest {

    private static final String SUPER_EMAIL = "roles-super-" + UUID.randomUUID() + "@bigbike.test";
    private static final String SUPER_PASS  = "Super@Roles12345";

    private static final String READER_EMAIL = "roles-reader-" + UUID.randomUUID() + "@bigbike.test";
    private static final String READER_PASS  = "Reader@Roles1234";

    private static final String ROLES_URL  = "/api/v1/admin/roles";
    private static final String PERMS_URL  = "/api/v1/admin/permissions";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired AdminRoleJpaRepository roleRepo;
    @Autowired PasswordService passwordService;

    private MockMvc mockMvc;
    private String superToken;
    private String readerToken;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureAdminUser(SUPER_EMAIL, SUPER_PASS, "SUPER_ADMIN");
        ensureAdminUser(READER_EMAIL, READER_PASS, "EDITOR");
        superToken  = loginAdmin(SUPER_EMAIL, SUPER_PASS);
        readerToken = loginAdmin(READER_EMAIL, READER_PASS);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LIST ROLES — GET /api/v1/admin/roles
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    void listRoles_withoutToken_returns401() throws Exception {
        mockMvc.perform(get(ROLES_URL)).andExpect(status().isUnauthorized());
    }

    @Test
    void listRoles_withRolesReadPermission_returns200AndArray() throws Exception {
        mockMvc.perform(get(ROLES_URL)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void listRoles_editorHasNoRolesRead_returns403() throws Exception {
        mockMvc.perform(get(ROLES_URL)
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void listRoles_responseContainsSystemRoles() throws Exception {
        MvcResult result = mockMvc.perform(get(ROLES_URL)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isOk())
                .andReturn();
        String json = result.getResponse().getContentAsString();
        assertThat(json).contains("SUPER_ADMIN");
        assertThat(json).contains("ADMIN");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PERMISSIONS CATALOG — GET /api/v1/admin/permissions
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    void listPermissions_withoutToken_returns401() throws Exception {
        mockMvc.perform(get(PERMS_URL)).andExpect(status().isUnauthorized());
    }

    @Test
    void listPermissions_withRolesRead_returns200WithGroups() throws Exception {
        MvcResult result = mockMvc.perform(get(PERMS_URL)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andReturn();
        String json = result.getResponse().getContentAsString();
        assertThat(json).contains("groupKey");
        assertThat(json).contains("permissions");
        assertThat(json).contains("roles.read");
        assertThat(json).contains("roles.write");
        assertThat(json).contains("pos.read");
        assertThat(json).contains("receivables.read");
        assertThat(json).contains("reports.read");
    }

    @Test
    void listPermissions_editorHasNoRolesRead_returns403() throws Exception {
        mockMvc.perform(get(PERMS_URL)
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void listPermissions_includesPosRefundAndInventoryKeys() throws Exception {
        MvcResult result = mockMvc.perform(get(PERMS_URL)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isOk())
                .andReturn();
        String json = result.getResponse().getContentAsString();
        // FULL-01: these permissions are seeded into role_permissions by V109/V112
        // and must be exposed by the catalog so they are grantable via the Roles UI.
        assertThat(json).contains("pos.refund");
        assertThat(json).contains("inventory.read");
        assertThat(json).contains("inventory.write");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CREATE ROLE — POST /api/v1/admin/roles
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    void createRole_withoutToken_returns401() throws Exception {
        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"TEST_ROLE\",\"name\":\"Test\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createRole_editorLacksRolesWrite_returns403() throws Exception {
        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"EDITOR_ROLE\",\"name\":\"Editor Role\"}")
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void createRole_validInput_returns201() throws Exception {
        String id = "CUSTOM_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        String body = """
                {"id":"%s","name":"Custom Role","description":"For testing","permissions":["orders.read"]}
                """.formatted(id);

        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(id))
                .andExpect(jsonPath("$.data.isSystem").value(false))
                .andExpect(jsonPath("$.data.permissions").isArray());
    }

    @Test
    void createRole_blankId_returns400() throws Exception {
        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"\",\"name\":\"No ID Role\"}")
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createRole_blankName_returns400() throws Exception {
        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"VALID_ID\",\"name\":\"\"}")
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createRole_invalidIdFormat_returns400() throws Exception {
        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"invalid-lowercase\",\"name\":\"Bad ID\"}")
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createRole_duplicateId_returns409() throws Exception {
        String id = "DUP_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        String body = "{\"id\":\"" + id + "\",\"name\":\"Dup Role\",\"permissions\":[]}";

        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isCreated());

        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isConflict());
    }

    @Test
    void createRole_unknownPermissionKey_returns400() throws Exception {
        String body = """
                {"id":"BAD_PERMS_ROLE","name":"Bad Perms",
                 "permissions":["orders.read","garbage.permission.key"]}
                """;
        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createRole_withPosRefundAndInventoryPermissions_returns201() throws Exception {
        // FULL-01: a custom role must be assignable pos.refund / inventory.read /
        // inventory.write — these are real permissions seeded by V109/V112.
        String id = "INV_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        String body = """
                {"id":"%s","name":"Warehouse Role","description":"Inventory + refund",
                 "permissions":["pos.refund","inventory.read","inventory.write"]}
                """.formatted(id);

        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(id))
                .andExpect(jsonPath("$.data.permissions").isArray());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // UPDATE ROLE PERMISSIONS — PUT /api/v1/admin/roles/{id}/permissions
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    void updatePermissions_withoutToken_returns401() throws Exception {
        mockMvc.perform(put(ROLES_URL + "/EDITOR/permissions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permissions\":[\"content.read\"]}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void updatePermissions_editorLacksRolesWrite_returns403() throws Exception {
        mockMvc.perform(put(ROLES_URL + "/EDITOR/permissions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permissions\":[\"content.read\"]}")
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void updatePermissions_validRole_returns200() throws Exception {
        String id = "UPD_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        createCustomRole(id, "Update Test Role");

        mockMvc.perform(put(ROLES_URL + "/" + id + "/permissions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permissions\":[\"orders.read\",\"customers.read\"]}")
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.permissions").isArray());
    }

    @Test
    void updatePermissions_unknownPermission_returns400() throws Exception {
        String id = "UPD2_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        createCustomRole(id, "Update Test Role 2");

        mockMvc.perform(put(ROLES_URL + "/" + id + "/permissions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permissions\":[\"orders.read\",\"totally.fake.perm\"]}")
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updatePermissions_superAdmin_returns409() throws Exception {
        mockMvc.perform(put(ROLES_URL + "/SUPER_ADMIN/permissions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permissions\":[\"orders.read\"]}")
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isConflict());
    }

    @Test
    void updatePermissions_roleNotFound_returns404() throws Exception {
        mockMvc.perform(put(ROLES_URL + "/NONEXISTENT_ROLE/permissions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permissions\":[\"orders.read\"]}")
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isNotFound());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // DELETE ROLE — DELETE /api/v1/admin/roles/{id}
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    void deleteRole_withoutToken_returns401() throws Exception {
        mockMvc.perform(delete(ROLES_URL + "/EDITOR"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deleteRole_editorLacksRolesWrite_returns403() throws Exception {
        mockMvc.perform(delete(ROLES_URL + "/EDITOR")
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void deleteRole_systemRole_returns409() throws Exception {
        mockMvc.perform(delete(ROLES_URL + "/ADMIN")
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isConflict());
    }

    @Test
    void deleteRole_customRoleNotFound_returns404() throws Exception {
        mockMvc.perform(delete(ROLES_URL + "/ROLE_DOES_NOT_EXIST_XYZ")
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteRole_customRoleInUse_returns409() throws Exception {
        String roleId = "INUSE_" + UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
        createCustomRole(roleId, "In-Use Role");

        // Assign a user to this role
        String userEmail = "role-user-" + UUID.randomUUID() + "@bigbike.test";
        ensureAdminUser(userEmail, "Temp@12345678", roleId);

        mockMvc.perform(delete(ROLES_URL + "/" + roleId)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isConflict());
    }

    @Test
    void deleteRole_customRoleWithNoUsers_returns204() throws Exception {
        String roleId = "DEL_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        createCustomRole(roleId, "Deletable Role");

        mockMvc.perform(delete(ROLES_URL + "/" + roleId)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isNoContent());

        assertThat(roleRepo.findById(roleId)).isEmpty();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    private void createCustomRole(String id, String name) throws Exception {
        String body = "{\"id\":\"" + id + "\",\"name\":\"" + name + "\",\"permissions\":[]}";
        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isCreated());
    }

    private void ensureAdminUser(String email, String password, String role) {
        adminUserRepo.findByEmail(email).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(email);
            admin.setPasswordHash(passwordService.hash(password));
            admin.setDisplayName("Roles Test " + role);
            admin.setRole(role);
            admin.setStatus("ACTIVE");
            Instant now = Instant.now();
            admin.setCreatedAt(now);
            admin.setUpdatedAt(now);
            return adminUserRepo.save(admin);
        });
    }

    private String loginAdmin(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return extractJsonValue(result.getResponse().getContentAsString(), "accessToken");
    }

    private String extractJsonValue(String json, String key) {
        String marker = "\"" + key + "\":\"";
        int start = json.indexOf(marker);
        if (start < 0) return null;
        start += marker.length();
        int end = json.indexOf("\"", start);
        if (end < 0) return null;
        return json.substring(start, end);
    }
}
