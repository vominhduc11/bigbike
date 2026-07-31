package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminRoleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import java.time.Instant;
import java.util.ArrayList;
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
    private final ObjectMapper objectMapper = new ObjectMapper();

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

    @Test
    void listRoles_onlyHasTwoSystemRoles_andRetainsHistoricalRolesAsCustom() throws Exception {
        MvcResult result = mockMvc.perform(get(ROLES_URL)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode roles = objectMapper.readTree(result.getResponse().getContentAsString()).get("data");
        List<String> systemRoleIds = new ArrayList<>();
        roles.forEach(role -> {
            if (role.path("isSystem").asBoolean()) {
                systemRoleIds.add(role.path("id").asText());
            }
        });

        assertThat(systemRoleIds).containsExactlyInAnyOrder("SUPER_ADMIN", "ADMIN");

        JsonNode editor = findRole(roles, "EDITOR");
        assertThat(editor).isNotNull();
        assertThat(editor.path("isSystem").asBoolean()).isFalse();
        assertThat(editor.path("assignedUserCount").asLong()).isGreaterThanOrEqualTo(1L);
        assertThat(editor.path("permissions").toString()).contains("content.read");
    }

    @Test
    void listRoles_assignedUserCountIncludesAllAdminStatusesAndDefaultsToZero() throws Exception {
        String roleId = "COUNT_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        String emptyRoleId = "EMPTY_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        createCustomRole(roleId, "Count Test Role");
        createCustomRole(emptyRoleId, "Empty Count Role");

        for (String status : new String[] {"ACTIVE", "INVITED", "DISABLED", "SUSPENDED"}) {
            ensureAdminUser(
                    "role-count-" + status.toLowerCase() + "-" + UUID.randomUUID() + "@bigbike.test",
                    "Temp@12345678", roleId, status);
        }

        MvcResult result = mockMvc.perform(get(ROLES_URL)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode roles = objectMapper.readTree(result.getResponse().getContentAsString()).get("data");
        JsonNode countedRole = findRole(roles, roleId);
        JsonNode emptyRole = findRole(roles, emptyRoleId);
        assertThat(countedRole).isNotNull();
        assertThat(countedRole.path("assignedUserCount").asLong()).isEqualTo(4L);
        assertThat(emptyRole).isNotNull();
        assertThat(emptyRole.path("assignedUserCount").asLong()).isZero();
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
        assertThat(json).contains("reports.read");
    }

    @Test
    void listPermissions_editorHasNoRolesRead_returns403() throws Exception {
        mockMvc.perform(get(PERMS_URL)
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void listPermissions_excludesRemovedPosAndInventoryWrite() throws Exception {
        MvcResult result = mockMvc.perform(get(PERMS_URL)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isOk())
                .andReturn();
        String json = result.getResponse().getContentAsString();
        // POS permissions and the orphan inventory.write permission are removed modules/keys.
        assertThat(json).doesNotContain("pos.refund");
        assertThat(json).contains("inventory.read");
        assertThat(json).doesNotContain("inventory.write");
    }

    @Test
    void listPermissions_exposesDependencyMetadataAndSensitiveExport() throws Exception {
        mockMvc.perform(get(PERMS_URL)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].permissions[?(@.key == 'products.update')].moduleKey")
                        .value(org.hamcrest.Matchers.hasItem("products")))
                .andExpect(jsonPath("$.data[*].permissions[?(@.key == 'products.update')].kind")
                        .value(org.hamcrest.Matchers.hasItem("WRITE")))
                .andExpect(jsonPath("$.data[*].permissions[?(@.key == 'products.update')].requires[0]")
                        .value(org.hamcrest.Matchers.hasItem("products.read")))
                .andExpect(jsonPath("$.data[*].permissions[?(@.key == 'reports.export')].sensitive")
                        .value(org.hamcrest.Matchers.hasItem(true)))
                .andExpect(jsonPath("$.data[*].permissions[?(@.key == 'inventory.read')].kind")
                        .value(org.hamcrest.Matchers.hasItem("SUPPORTING")));
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
                .andExpect(jsonPath("$.data.permissions").isArray())
                .andExpect(jsonPath("$.data.assignedUserCount").value(0));
    }

    @Test
    void createRole_missingPermissionDependencies_returnsDetailed400() throws Exception {
        String id = "MISSING_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        String body = """
                {"id":"%s","name":"Malformed Role","permissions":["products.update"]}
                """.formatted(id);

        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[*].field")
                        .value(org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.is("permissions"))))
                .andExpect(jsonPath("$.error.details[*].code")
                        .value(org.hamcrest.Matchers.everyItem(
                                org.hamcrest.Matchers.is("MISSING_PERMISSION_DEPENDENCY"))))
                .andExpect(jsonPath("$.error.details[*].message")
                        .value(org.hamcrest.Matchers.hasItems(
                                "Permission 'products.update' requires 'products.read'.",
                                "Permission 'products.update' requires 'catalog.read'.")));

        assertThat(roleRepo.existsById(id)).isFalse();
    }

    @Test
    void createRole_dependencyClosedPayload_isAccepted() throws Exception {
        String id = "CLOSED_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        String body = """
                {"id":"%s","name":"Closed Role","permissions":["products.update","products.read","catalog.read"]}
                """.formatted(id);

        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.permissions",
                        org.hamcrest.Matchers.containsInAnyOrder(
                                "products.update", "products.read", "catalog.read")));
    }

    @Test
    void createRole_wildcardCannotBeGrantedToCustomRole() throws Exception {
        String id = "WILDCARD_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        String body = """
                {"id":"%s","name":"Wildcard Role","permissions":["*"]}
                """.formatted(id);

        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].code").value("UNKNOWN_PERMISSION"));
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
    void createRole_nameLongerThanDatabaseColumn_returns400() throws Exception {
        String longName = "N".repeat(101);
        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"VALID_NAME_LIMIT\",\"name\":\"" + longName + "\"}")
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
    void createRole_withInventoryReadPermission_returns201() throws Exception {
        // Inventory visibility remains a real Dashboard/API read boundary.
        String id = "INV_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        String body = """
                {"id":"%s","name":"Warehouse Role","description":"Inventory",
                 "permissions":["inventory.read"]}
                """.formatted(id);

        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(id))
                .andExpect(jsonPath("$.data.permissions").isArray());
    }

    @Test
    void createRole_withRemovedInventoryWritePermission_returns400() throws Exception {
        String id = "INVW_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        String body = """
                {"id":"%s","name":"Legacy Inventory Writer","description":"stale",
                 "permissions":["inventory.write"]}
                """.formatted(id);

        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].code").value("UNKNOWN_PERMISSION"));
    }

    @Test
    void createRole_withRemovedPosPermission_returns400() throws Exception {
        // Chốt hành vi: permission đã gỡ (pos.*) không còn được gán cho role mới.
        String id = "POS_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        String body = """
                {"id":"%s","name":"Legacy POS Role","description":"stale",
                 "permissions":["pos.refund"]}
                """.formatted(id);

        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].code").value("UNKNOWN_PERMISSION"));
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
                .andExpect(jsonPath("$.data.permissions").isArray())
                .andExpect(jsonPath("$.data.assignedUserCount").value(0));
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

    @Test
    void updatePermissions_cannotRemoveRoleManagementFromOwnRole_returns409() throws Exception {
        String roleId = "SELF_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        String roleBody = """
                {"id":"%s","name":"Self Managed Role",
                 "permissions":["roles.read","roles.write"]}
                """.formatted(roleId);
        mockMvc.perform(post(ROLES_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(roleBody)
                        .header("Authorization", "Bearer " + superToken))
                .andExpect(status().isCreated());

        String email = "role-self-" + UUID.randomUUID() + "@bigbike.test";
        ensureAdminUser(email, "Temp@12345678", roleId);
        String ownRoleToken = loginAdmin(email, "Temp@12345678");

        mockMvc.perform(put(ROLES_URL + "/" + roleId + "/permissions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permissions\":[\"roles.read\"]}")
                        .header("Authorization", "Bearer " + ownRoleToken))
                .andExpect(status().isConflict());
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
        ensureAdminUser(email, password, role, "ACTIVE");
    }

    private void ensureAdminUser(String email, String password, String role, String status) {
        adminUserRepo.findByEmail(email).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(email);
            admin.setPasswordHash(passwordService.hash(password));
            admin.setDisplayName("Roles Test " + role);
            admin.setRole(role);
            admin.setStatus(status);
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

    private JsonNode findRole(JsonNode roles, String roleId) {
        for (JsonNode role : roles) {
            if (roleId.equals(role.path("id").asText())) return role;
        }
        return null;
    }
}
