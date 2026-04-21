package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.menu.MenuItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.menu.MenuJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import java.time.Instant;
import java.util.List;
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
        ensureAdminUser();
        adminToken = loginAdmin();
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
    // SECTION 5 — OpenAPI static spec regression checks
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    void openApiDocsEndpoint_stillWorks() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk());
    }

    @Test
    void openApi_couponStatusIncludesArchived() throws Exception {
        MvcResult result = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(result.getResponse().getContentAsString()).contains("ARCHIVED");
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
    // HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    private void ensureAdminUser() {
        adminUserRepo.findByEmail(ADMIN_EMAIL).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(ADMIN_EMAIL);
            admin.setPasswordHash(passwordService.hash(ADMIN_PASS));
            admin.setDisplayName("Phase1K1 Test Admin");
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

    private String extractJsonValue(String json, String key) {
        String marker = "\"" + key + "\":\"";
        int start = json.indexOf(marker);
        if (start < 0) return null;
        start += marker.length();
        int end = json.indexOf("\"", start);
        return json.substring(start, end);
    }
}
