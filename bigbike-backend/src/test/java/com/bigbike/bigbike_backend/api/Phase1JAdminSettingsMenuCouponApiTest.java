package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.coupon.CouponEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.coupon.CouponJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.menu.MenuItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.menu.MenuJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.mock.web.MockHttpServletResponse;
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
class Phase1JAdminSettingsMenuCouponApiTest {

    private static final String ADMIN_EMAIL = "1j-admin-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS  = "Admin@1J2345678";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired AuditLogJpaRepository auditLogRepo;
    @Autowired SiteSettingJpaRepository settingRepo;
    @Autowired MenuJpaRepository menuRepo;
    @Autowired MenuItemJpaRepository menuItemRepo;
    @Autowired CouponJpaRepository couponRepo;
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

    // ══════════════════════════════════════════════════════════════════════════
    // SETTINGS TESTS (1–7)
    // ══════════════════════════════════════════════════════════════════════════

    // 1. No auth → 401
    @Test
    void adminSettings_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/settings"))
                .andExpect(status().isUnauthorized());
    }

    // 2. Authenticated → settings list returned
    @Test
    void adminSettings_withAdminToken_returnsList() throws Exception {
        createTestSetting("site.name", "BigBike", "general", true);

        mockMvc.perform(get("/api/v1/admin/settings")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.pagination.page").value(1));
    }

    // 3. Filter by group works
    @Test
    void adminSettings_filterByGroup() throws Exception {
        String group = "grp-" + UUID.randomUUID().toString().substring(0, 8);
        createTestSetting("test.group.key." + UUID.randomUUID(), "value", group, false);

        mockMvc.perform(get("/api/v1/admin/settings")
                        .param("group", group)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].settingGroup").value(group));
    }

    // 4. Get setting by key
    @Test
    void adminSettings_getByKey_returnsDetail() throws Exception {
        String key = "key-" + UUID.randomUUID().toString().substring(0, 8);
        createTestSetting(key, "hello-world", "test-group", false);

        mockMvc.perform(get("/api/v1/admin/settings/" + key)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.settingKey").value(key))
                .andExpect(jsonPath("$.data.settingValue").value("hello-world"));
    }

    // 5. Update setting value
    @Test
    void adminSettings_updateValue_succeeds() throws Exception {
        String key = "upd-" + UUID.randomUUID().toString().substring(0, 8);
        createTestSetting(key, "old-value", "general", false);

        mockMvc.perform(patch("/api/v1/admin/settings/" + key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"new-value\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.settingValue").value("new-value"));
    }

    // 6. Sensitive key cannot be made public
    @Test
    void adminSettings_sensitiveKey_cannotBePublic() throws Exception {
        String key = "app.secret.key." + UUID.randomUUID().toString().substring(0, 8);
        createTestSetting(key, "super-secret", "auth", false);

        mockMvc.perform(patch("/api/v1/admin/settings/" + key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isPublic\":true}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 7. Public settings endpoint (no auth required) — registry-allowlisted keys are exposed,
    // non-public keys are filtered. site_name is allowlisted; tax_enabled is registry-known but
    // not publicly allowed.
    @Test
    void publicSettings_returnsOnlyPublicSettings() throws Exception {
        createTestSetting("site_name", "BigBike", "general", true);
        createTestSetting("tax_enabled", "false", "TAX", false);

        MvcResult result = mockMvc.perform(get("/api/v1/settings/public"))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("\"settingKey\":\"site_name\"");
        assertThat(body).doesNotContain("\"settingKey\":\"tax_enabled\"");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MENU TESTS (8–18)
    // ══════════════════════════════════════════════════════════════════════════

    // 8. No auth → 401
    @Test
    void adminMenus_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/menus"))
                .andExpect(status().isUnauthorized());
    }

    // 9. Authenticated → menus list returned
    @Test
    void adminMenus_withAdminToken_returnsList() throws Exception {
        createTestMenu("header-" + UUID.randomUUID().toString().substring(0, 8), "Header Menu");

        mockMvc.perform(get("/api/v1/admin/menus")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.pagination.page").value(1));
    }

    // 10. Create menu
    @Test
    void adminMenus_create_succeeds() throws Exception {
        String location = "loc-" + UUID.randomUUID().toString().substring(0, 8);

        mockMvc.perform(post("/api/v1/admin/menus")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"location\":\"" + location + "\",\"name\":\"Test Menu\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.location").value(location))
                .andExpect(jsonPath("$.data.name").value("Test Menu"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    // 11. Create duplicate location → 409
    @Test
    void adminMenus_createDuplicateLocation_returns409() throws Exception {
        String location = "dup-loc-" + UUID.randomUUID().toString().substring(0, 8);
        createTestMenu(location, "First Menu");

        mockMvc.perform(post("/api/v1/admin/menus")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"location\":\"" + location + "\",\"name\":\"Second Menu\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());
    }

    // 12. Get menu by ID with items
    @Test
    void adminMenus_getById_returnsMenuWithItems() throws Exception {
        String location = "byid-" + UUID.randomUUID().toString().substring(0, 8);
        MenuEntity menu = createTestMenu(location, "Nav Menu");
        createTestMenuItem(menu, "Home", "/", null, 0);
        createTestMenuItem(menu, "About", "/about", null, 1);

        mockMvc.perform(get("/api/v1/admin/menus/" + menu.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.location").value(location))
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.items.length()").value(2));
    }

    // 13. Update menu name
    @Test
    void adminMenus_update_succeeds() throws Exception {
        String location = "upd-menu-" + UUID.randomUUID().toString().substring(0, 8);
        MenuEntity menu = createTestMenu(location, "Old Name");

        mockMvc.perform(patch("/api/v1/admin/menus/" + menu.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"New Name\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("New Name"));
    }

    // 14. Add menu item
    @Test
    void adminMenus_createItem_succeeds() throws Exception {
        String location = "item-create-" + UUID.randomUUID().toString().substring(0, 8);
        MenuEntity menu = createTestMenu(location, "With Items");

        mockMvc.perform(post("/api/v1/admin/menus/" + menu.getId() + "/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"label\":\"Products\",\"url\":\"/products\",\"sortOrder\":0}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.label").value("Products"))
                .andExpect(jsonPath("$.data.url").value("/products"));
    }

    // 15. Reorder items
    @Test
    void adminMenus_reorderItems_succeeds() throws Exception {
        String location = "reorder-" + UUID.randomUUID().toString().substring(0, 8);
        MenuEntity menu = createTestMenu(location, "Reorder Menu");
        MenuItemEntity item1 = createTestMenuItem(menu, "First", "/first", null, 0);
        MenuItemEntity item2 = createTestMenuItem(menu, "Second", "/second", null, 1);

        String reorderBody = """
                {
                  "items": [
                    {"id":"%s","parentId":null,"sortOrder":1},
                    {"id":"%s","parentId":null,"sortOrder":0}
                  ]
                }
                """.formatted(item1.getId(), item2.getId());

        mockMvc.perform(post("/api/v1/admin/menus/" + menu.getId() + "/items/reorder")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reorderBody)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items").isArray());
    }

    // 16. Delete menu item (physical)
    @Test
    void adminMenus_deleteItem_returns204() throws Exception {
        String location = "del-item-" + UUID.randomUUID().toString().substring(0, 8);
        MenuEntity menu = createTestMenu(location, "Delete Item Menu");
        MenuItemEntity item = createTestMenuItem(menu, "ToDelete", "/to-delete", null, 0);

        mockMvc.perform(delete("/api/v1/admin/menus/" + menu.getId() + "/items/" + item.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        // Verify physically deleted
        assertThat(menuItemRepo.findById(item.getId())).isEmpty();
    }

    // 17. Delete menu (physical with items)
    @Test
    void adminMenus_deleteMenu_returns204() throws Exception {
        String location = "del-menu-" + UUID.randomUUID().toString().substring(0, 8);
        MenuEntity menu = createTestMenu(location, "To Delete Menu");
        createTestMenuItem(menu, "Item1", "/item1", null, 0);

        mockMvc.perform(delete("/api/v1/admin/menus/" + menu.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        assertThat(menuRepo.findById(menu.getId())).isEmpty();
    }

    // 18. Public menu endpoint (no auth)
    @Test
    void publicMenu_byLocation_returnsActiveItems() throws Exception {
        String location = "pub-menu-" + UUID.randomUUID().toString().substring(0, 8);
        MenuEntity menu = createTestMenu(location, "Public Nav");
        createTestMenuItem(menu, "Home", "/", null, 0);
        // Create a hidden item
        MenuItemEntity hiddenItem = createTestMenuItem(menu, "Hidden", "/hidden", null, 1);
        hiddenItem.setStatus("INACTIVE");
        menuItemRepo.save(hiddenItem);

        MvcResult result = mockMvc.perform(get("/api/v1/menus/" + location))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("Home");
        assertThat(body).doesNotContain("Hidden");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // COUPON TESTS (19–28)
    // ══════════════════════════════════════════════════════════════════════════

    // 19. No auth → 401
    @Test
    void adminCoupons_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/coupons"))
                .andExpect(status().isUnauthorized());
    }

    // 20. Authenticated → list returned
    @Test
    void adminCoupons_withAdminToken_returnsList() throws Exception {
        createTestCoupon("LIST-" + UUID.randomUUID().toString().substring(0, 6));

        mockMvc.perform(get("/api/v1/admin/coupons")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.pagination.page").value(1));
    }

    // 21. Create coupon FIXED type
    @Test
    void adminCoupons_createFixed_succeeds() throws Exception {
        String code = "FIXED-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();

        mockMvc.perform(post("/api/v1/admin/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","name":"Fixed Coupon","discountType":"FIXED","amount":50000}
                                """.formatted(code))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.code").value(code))
                .andExpect(jsonPath("$.data.discountType").value("FIXED"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    // 22. Create coupon PERCENT type
    @Test
    void adminCoupons_createPercent_succeeds() throws Exception {
        String code = "PCT-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();

        mockMvc.perform(post("/api/v1/admin/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","name":"Percent Coupon","discountType":"PERCENT","amount":15}
                                """.formatted(code))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.discountType").value("PERCENT"))
                .andExpect(jsonPath("$.data.amount").value(15));
    }

    // 23. Invalid discountType → 400
    @Test
    void adminCoupons_invalidDiscountType_returns400() throws Exception {
        String code = "BAD-TYPE-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();

        mockMvc.perform(post("/api/v1/admin/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","name":"Bad Coupon","discountType":"INVALID","amount":10}
                                """.formatted(code))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 24. PERCENT > 100 → 400
    @Test
    void adminCoupons_percentOver100_returns400() throws Exception {
        String code = "OVER100-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();

        mockMvc.perform(post("/api/v1/admin/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","name":"Over 100%%","discountType":"PERCENT","amount":101}
                                """.formatted(code))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 25. Duplicate code → 409
    @Test
    void adminCoupons_duplicateCode_returns409() throws Exception {
        String code = "DUP-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        createTestCoupon(code);

        mockMvc.perform(post("/api/v1/admin/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","name":"Dup Coupon","discountType":"FIXED","amount":1000}
                                """.formatted(code))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());
    }

    // 26. Update coupon name
    @Test
    void adminCoupons_updateName_succeeds() throws Exception {
        CouponEntity coupon = createTestCoupon("UPD-" + UUID.randomUUID().toString().substring(0, 6));

        mockMvc.perform(patch("/api/v1/admin/coupons/" + coupon.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Updated Coupon Name\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Updated Coupon Name"));
    }

    // 27. Update coupon status
    @Test
    void adminCoupons_updateStatus_succeeds() throws Exception {
        CouponEntity coupon = createTestCoupon("STS-" + UUID.randomUUID().toString().substring(0, 6));

        mockMvc.perform(patch("/api/v1/admin/coupons/" + coupon.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"INACTIVE\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("INACTIVE"));
    }

    // 28. Get coupon detail
    @Test
    void adminCoupons_getById_returnsDetail() throws Exception {
        CouponEntity coupon = createTestCoupon("DET-" + UUID.randomUUID().toString().substring(0, 6));

        mockMvc.perform(get("/api/v1/admin/coupons/" + coupon.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(coupon.getId().toString()))
                .andExpect(jsonPath("$.data.discountType").value("FIXED"));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HARDENING TESTS — Coupon status (29–32)
    // ══════════════════════════════════════════════════════════════════════════

    // 29. Create coupon with ARCHIVED status succeeds
    @Test
    void createCoupon_archivedStatus_succeeds() throws Exception {
        String code = "ARCH-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();

        mockMvc.perform(post("/api/v1/admin/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","name":"Archived Coupon","discountType":"FIXED","amount":500,"status":"ARCHIVED"}
                                """.formatted(code))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ARCHIVED"));
    }

    // 30. Update coupon status to ARCHIVED succeeds
    @Test
    void updateCouponStatus_archived_succeeds() throws Exception {
        CouponEntity coupon = createTestCoupon("TARCH-" + UUID.randomUUID().toString().substring(0, 6));

        mockMvc.perform(patch("/api/v1/admin/coupons/" + coupon.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ARCHIVED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ARCHIVED"));
    }

    // 31. Create coupon with invalid status → 400
    @Test
    void createCoupon_invalidStatus_returns400() throws Exception {
        String code = "BADSTS-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();

        mockMvc.perform(post("/api/v1/admin/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","name":"Bad Status","discountType":"FIXED","amount":500,"status":"DELETED"}
                                """.formatted(code))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 32. Update coupon with invalid status → 400
    @Test
    void updateCoupon_invalidStatus_returns400() throws Exception {
        CouponEntity coupon = createTestCoupon("UPDSTS-" + UUID.randomUUID().toString().substring(0, 6));

        mockMvc.perform(patch("/api/v1/admin/coupons/" + coupon.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"TRASH\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HARDENING TESTS — Menu status (33–37)
    // ══════════════════════════════════════════════════════════════════════════

    // 33. Create menu with invalid status → 400
    @Test
    void createMenu_invalidStatus_returns400() throws Exception {
        String location = "sts-invalid-" + UUID.randomUUID().toString().substring(0, 8);

        mockMvc.perform(post("/api/v1/admin/menus")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"location\":\"" + location + "\",\"name\":\"Bad Status\",\"status\":\"DELETED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 34. Update menu with invalid status → 400
    @Test
    void updateMenu_invalidStatus_returns400() throws Exception {
        String location = "sts-upd-" + UUID.randomUUID().toString().substring(0, 8);
        MenuEntity menu = createTestMenu(location, "Status Update Menu");

        mockMvc.perform(patch("/api/v1/admin/menus/" + menu.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ARCHIVED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 35. Create menu item with invalid status → 400
    @Test
    void createMenuItem_invalidStatus_returns400() throws Exception {
        String location = "item-sts-" + UUID.randomUUID().toString().substring(0, 8);
        MenuEntity menu = createTestMenu(location, "Item Status Menu");

        mockMvc.perform(post("/api/v1/admin/menus/" + menu.getId() + "/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"label\":\"Bad Item\",\"url\":\"/bad\",\"status\":\"DELETED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 36. Update menu item with invalid status → 400
    @Test
    void updateMenuItem_invalidStatus_returns400() throws Exception {
        String location = "item-sts-upd-" + UUID.randomUUID().toString().substring(0, 8);
        MenuEntity menu = createTestMenu(location, "Item Status Update Menu");
        MenuItemEntity item = createTestMenuItem(menu, "Item", "/item", null, 0);

        mockMvc.perform(patch("/api/v1/admin/menus/" + menu.getId() + "/items/" + item.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"EXPIRED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 37. Public menu for INACTIVE menu → 404
    @Test
    void publicMenu_inactiveMenu_returns404() throws Exception {
        String location = "inactive-pub-" + UUID.randomUUID().toString().substring(0, 8);
        MenuEntity menu = createTestMenu(location, "Inactive Menu");
        menu.setStatus("INACTIVE");
        menuRepo.save(menu);

        mockMvc.perform(get("/api/v1/menus/" + location))
                .andExpect(status().isNotFound());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HARDENING TESTS — Menu deep cycle (38–41)
    // ══════════════════════════════════════════════════════════════════════════

    // 38. Update menu item: deep cycle A→B→A → 400
    @Test
    void updateMenuItem_deepCycle_returns400() throws Exception {
        String location = "cycle-deep-" + UUID.randomUUID().toString().substring(0, 8);
        MenuEntity menu = createTestMenu(location, "Cycle Menu");
        MenuItemEntity itemA = createTestMenuItem(menu, "Item A", "/a", null, 0);
        MenuItemEntity itemB = createTestMenuItem(menu, "Item B", "/b", itemA.getId(), 1);
        // Now try to set A's parent to B — would create A→B→A cycle

        mockMvc.perform(patch("/api/v1/admin/menus/" + menu.getId() + "/items/" + itemA.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"parentId\":\"" + itemB.getId() + "\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 39. Reorder: parentId from another menu → 400
    @Test
    void reorderMenuItems_parentFromOtherMenu_returns400() throws Exception {
        String locA = "reord-menu-a-" + UUID.randomUUID().toString().substring(0, 6);
        String locB = "reord-menu-b-" + UUID.randomUUID().toString().substring(0, 6);
        MenuEntity menuA = createTestMenu(locA, "Menu A");
        MenuEntity menuB = createTestMenu(locB, "Menu B");
        MenuItemEntity itemA = createTestMenuItem(menuA, "A Item", "/a", null, 0);
        MenuItemEntity itemB = createTestMenuItem(menuB, "B Item", "/b", null, 0);

        String body = """
                {"items":[{"id":"%s","parentId":"%s","sortOrder":0}]}
                """.formatted(itemA.getId(), itemB.getId());

        mockMvc.perform(post("/api/v1/admin/menus/" + menuA.getId() + "/items/reorder")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 40. Reorder: three-item cycle A→B, B→C, C→A → 400
    @Test
    void reorderMenuItems_deepCycle_returns400() throws Exception {
        String location = "reord-cycle-" + UUID.randomUUID().toString().substring(0, 6);
        MenuEntity menu = createTestMenu(location, "Reorder Cycle Menu");
        MenuItemEntity itemA = createTestMenuItem(menu, "A", "/a", null, 0);
        MenuItemEntity itemB = createTestMenuItem(menu, "B", "/b", null, 1);
        MenuItemEntity itemC = createTestMenuItem(menu, "C", "/c", null, 2);

        // Propose: A→parent=B, B→parent=C, C→parent=A (cycle)
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

        mockMvc.perform(post("/api/v1/admin/menus/" + menu.getId() + "/items/reorder")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 41. Reorder: self-parent → 400
    @Test
    void reorderMenuItems_selfParent_returns400() throws Exception {
        String location = "self-par-" + UUID.randomUUID().toString().substring(0, 6);
        MenuEntity menu = createTestMenu(location, "Self Parent Menu");
        MenuItemEntity item = createTestMenuItem(menu, "Self", "/self", null, 0);

        String body = """
                {"items":[{"id":"%s","parentId":"%s","sortOrder":0}]}
                """.formatted(item.getId(), item.getId());

        mockMvc.perform(post("/api/v1/admin/menus/" + menu.getId() + "/items/reorder")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // P0 FIX TESTS — Menu hierarchy (42–44)
    // ══════════════════════════════════════════════════════════════════════════

    // 42. PATCH item with clearParentId:true → item moves to root
    @Test
    void updateMenuItem_clearParentId_movesToRoot() throws Exception {
        String location = "clear-parent-" + UUID.randomUUID().toString().substring(0, 8);
        MenuEntity menu = createTestMenu(location, "Clear Parent Menu");
        MenuItemEntity parent = createTestMenuItem(menu, "Parent", "/parent", null, 0);
        MenuItemEntity child = createTestMenuItem(menu, "Child", "/child", parent.getId(), 1);

        mockMvc.perform(patch("/api/v1/admin/menus/" + menu.getId() + "/items/" + child.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clearParentId\":true}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        assertThat(menuItemRepo.findById(child.getId()))
                .get()
                .extracting(MenuItemEntity::getParentId)
                .isNull();
    }

    // 43. DELETE parent item that has children → 409
    @Test
    void deleteMenuItem_withChildren_returns409() throws Exception {
        String location = "del-with-child-" + UUID.randomUUID().toString().substring(0, 8);
        MenuEntity menu = createTestMenu(location, "Delete With Child");
        MenuItemEntity parent = createTestMenuItem(menu, "Parent", "/parent", null, 0);
        createTestMenuItem(menu, "Child", "/child", parent.getId(), 1);

        mockMvc.perform(delete("/api/v1/admin/menus/" + menu.getId() + "/items/" + parent.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());

        // parent must still exist
        assertThat(menuItemRepo.findById(parent.getId())).isPresent();
    }

    // 44. DELETE menu with 3-level hierarchy → 204 and all items removed
    @Test
    void deleteMenu_deepHierarchy_returns204AndCleansDb() throws Exception {
        String location = "del-deep-" + UUID.randomUUID().toString().substring(0, 8);
        MenuEntity menu = createTestMenu(location, "Deep Hierarchy Menu");
        MenuItemEntity root = createTestMenuItem(menu, "Root", "/root", null, 0);
        MenuItemEntity level2 = createTestMenuItem(menu, "Level2", "/l2", root.getId(), 0);
        MenuItemEntity level3 = createTestMenuItem(menu, "Level3", "/l3", level2.getId(), 0);

        mockMvc.perform(delete("/api/v1/admin/menus/" + menu.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        assertThat(menuRepo.findById(menu.getId())).isEmpty();
        assertThat(menuItemRepo.findById(root.getId())).isEmpty();
        assertThat(menuItemRepo.findById(level2.getId())).isEmpty();
        assertThat(menuItemRepo.findById(level3.getId())).isEmpty();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HARDENING TESTS — Settings sensitive keys (45–46)
    // ══════════════════════════════════════════════════════════════════════════

    // 42. api_key cannot be made public
    @Test
    void updateSetting_apiKeyCannotBePublic() throws Exception {
        String key = "stripe.api_key." + UUID.randomUUID().toString().substring(0, 6);
        createTestSetting(key, "sk_test_xxx", "payment", false);

        mockMvc.perform(patch("/api/v1/admin/settings/" + key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isPublic\":true}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 43. client_secret cannot be made public
    @Test
    void updateSetting_clientSecretCannotBePublic() throws Exception {
        String key = "oauth.client_secret." + UUID.randomUUID().toString().substring(0, 6);
        createTestSetting(key, "cs_super_secret", "auth", false);

        mockMvc.perform(patch("/api/v1/admin/settings/" + key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isPublic\":true}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE B — Settings registry: validation, masking, public allowlist
    // ══════════════════════════════════════════════════════════════════════════

    // PB1. Public endpoint filters out is_public=true rows whose key is not registry-allowlisted.
    @Test
    void publicSettings_unregisteredPublicKey_filteredByAllowlist() throws Exception {
        String key = "unreg_pub_" + UUID.randomUUID().toString().substring(0, 8);
        createTestSetting(key, "leakable", "misc", true);

        MvcResult result = mockMvc.perform(get("/api/v1/settings/public"))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).doesNotContain("\"settingKey\":\"" + key + "\"");
    }

    // PB2. Admin GET on a sensitive key returns a masked value, with sensitive=true masked=true.
    @Test
    void adminSettings_sensitiveValue_maskedOnGet() throws Exception {
        String key = "service.api_key." + UUID.randomUUID().toString().substring(0, 6);
        createTestSetting(key, "sk_live_DO_NOT_LEAK", "payment", false);

        mockMvc.perform(get("/api/v1/admin/settings/" + key)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.settingValue").value("********"))
                .andExpect(jsonPath("$.data.sensitive").value(true))
                .andExpect(jsonPath("$.data.masked").value(true));
    }

    // PB3. Non-sensitive registered keys are not masked and report sensitive=false.
    @Test
    void adminSettings_nonSensitiveValue_notMasked() throws Exception {
        createTestSetting("site_name", "BigBike", "general", true);

        mockMvc.perform(get("/api/v1/admin/settings/site_name")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sensitive").value(false))
                .andExpect(jsonPath("$.data.masked").value(false))
                .andExpect(jsonPath("$.data.valueType").value("STRING"));
    }

    // PB4. PATCH email key with malformed value → 400.
    @Test
    void adminSettings_invalidEmail_returns400() throws Exception {
        createTestSetting("contact_email", "info@bigbike.vn", "contact", true);

        mockMvc.perform(patch("/api/v1/admin/settings/contact_email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"not-an-email\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // PB5. PATCH phone key with non-numeric value → 400.
    @Test
    void adminSettings_invalidPhone_returns400() throws Exception {
        createTestSetting("hotline", "0906.90.2404", "contact", true);

        mockMvc.perform(patch("/api/v1/admin/settings/hotline")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"call-me-maybe\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // PB6. PATCH URL key with non-URL value → 400.
    @Test
    void adminSettings_invalidUrl_returns400() throws Exception {
        createTestSetting("facebook_url", "https://www.facebook.com/bigbikegear", "contact", true);

        mockMvc.perform(patch("/api/v1/admin/settings/facebook_url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"not a url\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // PB7. PATCH boolean key with non-boolean value → 400.
    @Test
    void adminSettings_invalidBoolean_returns400() throws Exception {
        createTestSetting("tax_enabled", "false", "TAX", false);

        mockMvc.perform(patch("/api/v1/admin/settings/tax_enabled")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"yes-please\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // PB8. PATCH integer key with out-of-range value → 400.
    @Test
    void adminSettings_integerOutOfRange_returns400() throws Exception {
        createTestSetting("login_max_attempts", "5", "SECURITY", false);

        mockMvc.perform(patch("/api/v1/admin/settings/login_max_attempts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"99999\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // PB9. PATCH enum key with disallowed value → 400.
    @Test
    void adminSettings_invalidEnum_returns400() throws Exception {
        createTestSetting("store_currency", "VND", "STORE", true);

        mockMvc.perform(patch("/api/v1/admin/settings/store_currency")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"GBP\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // PB10. PATCH decimal key with out-of-range value → 400.
    @Test
    void adminSettings_decimalOutOfRange_returns400() throws Exception {
        createTestSetting("tax_rate", "0.10", "TAX", false);

        mockMvc.perform(patch("/api/v1/admin/settings/tax_rate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"2\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // PB11. PATCH a registry-known but non-publicly-allowed key with isPublic=true → 400.
    @Test
    void adminSettings_registeredNonPublicKey_isPublicTrue_rejected() throws Exception {
        createTestSetting("tax_enabled", "false", "TAX", false);

        mockMvc.perform(patch("/api/v1/admin/settings/tax_enabled")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isPublic\":true}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // PB12. PATCH an unregistered key (no sensitive fragment) with isPublic=true → 400.
    @Test
    void adminSettings_unregisteredKey_isPublicTrue_rejected() throws Exception {
        String key = "wild_key_" + UUID.randomUUID().toString().substring(0, 8);
        createTestSetting(key, "v", "misc", false);

        mockMvc.perform(patch("/api/v1/admin/settings/" + key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isPublic\":true}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // PB13. PATCH known publicly-allowed key with valid value succeeds.
    @Test
    void adminSettings_validUpdateOnRegisteredKey_succeeds() throws Exception {
        createTestSetting("contact_email", "info@bigbike.vn", "contact", true);

        mockMvc.perform(patch("/api/v1/admin/settings/contact_email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"new-info@bigbike.vn\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.settingValue").value("new-info@bigbike.vn"))
                .andExpect(jsonPath("$.data.valueType").value("EMAIL"));
    }

    // PB14. Unregistered keys still accept arbitrary value updates (backward compat).
    @Test
    void adminSettings_unregisteredKey_anyValueAccepted() throws Exception {
        String key = "legacy_key_" + UUID.randomUUID().toString().substring(0, 8);
        createTestSetting(key, "old", "misc", false);

        mockMvc.perform(patch("/api/v1/admin/settings/" + key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"anything goes\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.settingValue").value("anything goes"));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // REGRESSION TESTS (44–53)
    // ══════════════════════════════════════════════════════════════════════════

    // 44. Admin orders still work (regression)
    @Test
    void adminOrders_stillWork() throws Exception {
        mockMvc.perform(get("/api/v1/admin/orders")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    // 30. Admin customers still work
    @Test
    void adminCustomers_stillWork() throws Exception {
        mockMvc.perform(get("/api/v1/admin/customers")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    // 31. Admin media still works
    @Test
    void adminMedia_stillWorks() throws Exception {
        mockMvc.perform(get("/api/v1/admin/media")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    // 32. Customer orders still protected
    @Test
    void customerOrders_stillProtected() throws Exception {
        mockMvc.perform(get("/api/v1/customer/orders"))
                .andExpect(status().isUnauthorized());
    }

    // 34. Guest order lookup still works
    @Test
    void guestOrderLookup_stillWorks() throws Exception {
        mockMvc.perform(get("/api/v1/orders/lookup")
                        .param("orderNumber", "BB-NOTEXIST-0001")
                        .param("orderKey", "bb_order_fakekey"))
                .andExpect(status().isNotFound());
    }

    // 35. Cart API still works
    @Test
    void cartApi_stillWorks() throws Exception {
        mockMvc.perform(get("/api/v1/cart"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    // 36. Public catalog still accessible
    @Test
    void publicCatalog_stillPublic() throws Exception {
        mockMvc.perform(get("/api/v1/products").param("page", "1").param("size", "2"))
                .andExpect(status().isOk());
    }

    // 37. Checkout options still public
    @Test
    void checkoutOptions_stillPublic() throws Exception {
        mockMvc.perform(get("/api/v1/checkout/options"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentMethods").isArray());
    }

    // 38. Public menus accessible without auth
    @Test
    void publicMenu_isAccessibleWithoutAuth() throws Exception {
        String location = "pub-reg-" + UUID.randomUUID().toString().substring(0, 8);
        createTestMenu(location, "Public Regression Menu");
        createTestMenuItem(createTestMenu(location + "-2",
                "Reg Menu 2"), "Link", "/link", null, 0);

        mockMvc.perform(get("/api/v1/menus/" + location))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.location").value(location));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // P0/P1 FIX TESTS — Coupon policy hardening
    // ══════════════════════════════════════════════════════════════════════════

    // P0-COUPON-03: switching discountType FIXED→PERCENT without a new amount must fail
    // when the existing amount (e.g. 200 000) exceeds the PERCENT max of 100
    @Test
    void updateCoupon_fixedToPercent_withHighAmount_returns400() throws Exception {
        CouponEntity coupon = createCouponWithAmount(
                "FTP-" + UUID.randomUUID().toString().substring(0, 6), "FIXED", new BigDecimal("200000"));

        mockMvc.perform(patch("/api/v1/admin/coupons/" + coupon.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"discountType\":\"PERCENT\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // P0-COUPON-03: switching FIXED→PERCENT while supplying a valid new amount must succeed
    @Test
    void updateCoupon_fixedToPercent_withValidAmount_succeeds() throws Exception {
        CouponEntity coupon = createCouponWithAmount(
                "FTP2-" + UUID.randomUUID().toString().substring(0, 6), "FIXED", new BigDecimal("200000"));

        mockMvc.perform(patch("/api/v1/admin/coupons/" + coupon.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"discountType\":\"PERCENT\",\"amount\":15}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.discountType").value("PERCENT"))
                .andExpect(jsonPath("$.data.amount").value(15));
    }

    // Cart: applying a nonexistent coupon code → 404
    @Test
    void applyCoupon_nonexistentCode_returns404() throws Exception {
        MvcResult cartResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = cartResult.getResponse().getCookies();
        String csrf = getCookieValue(cartResult.getResponse(), "bb_csrf");

        mockMvc.perform(post("/api/v1/cart/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"DOESNOTEXIST-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase() + "\"}")
                        .cookie(cookies)
                        .header("X-CSRF-Token", csrf))
                .andExpect(status().isNotFound());
    }

    // P0-COUPON-01 guard: applying an INACTIVE coupon → 409
    @Test
    void applyCoupon_inactiveCoupon_returns409() throws Exception {
        String code = "INACT-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        createCouponWithStatus(code, "INACTIVE");

        MvcResult cartResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = cartResult.getResponse().getCookies();
        String csrf = getCookieValue(cartResult.getResponse(), "bb_csrf");

        mockMvc.perform(post("/api/v1/cart/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + code + "\"}")
                        .cookie(cookies)
                        .header("X-CSRF-Token", csrf))
                .andExpect(status().isConflict());
    }

    // P0-COUPON-01 guard: applying an expired coupon (expiresAt in the past) → 409
    @Test
    void applyCoupon_expiredCoupon_returns409() throws Exception {
        String code = "EXPD-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        createExpiredCoupon(code);

        MvcResult cartResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = cartResult.getResponse().getCookies();
        String csrf = getCookieValue(cartResult.getResponse(), "bb_csrf");

        mockMvc.perform(post("/api/v1/cart/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + code + "\"}")
                        .cookie(cookies)
                        .header("X-CSRF-Token", csrf))
                .andExpect(status().isConflict());
    }

    // Happy path: applying a valid ACTIVE coupon with no minimumAmount → 200
    @Test
    void applyCoupon_validActiveCoupon_succeeds() throws Exception {
        String code = "VALID-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        createTestCoupon(code); // FIXED 10000, no minAmount, active, expires +30d

        MvcResult cartResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = cartResult.getResponse().getCookies();
        String csrf = getCookieValue(cartResult.getResponse(), "bb_csrf");

        mockMvc.perform(post("/api/v1/cart/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + code + "\"}")
                        .cookie(cookies)
                        .header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.couponCodes").isArray());
    }

    // P1-COUPON-06: SHOP_MANAGER can list coupons (SecurityConfig + role grant aligned)
    @Test
    void shopManager_canListCoupons() throws Exception {
        String smEmail = "sm-coupon-" + UUID.randomUUID() + "@bigbike.test";
        String smPass  = "ShopMgr@1Test";
        ensureShopManagerUser(smEmail, smPass);
        String smToken = loginAdminUser(smEmail, smPass);

        mockMvc.perform(get("/api/v1/admin/coupons")
                        .header("Authorization", "Bearer " + smToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    // P1-COUPON-04: applying a second coupon to the same cart → 409 (one-per-cart rule)
    @Test
    void applyCoupon_secondCoupon_returns409() throws Exception {
        String code1 = "FIRST-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        String code2 = "SECND-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        createTestCoupon(code1);
        createTestCoupon(code2);

        MvcResult cartResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = cartResult.getResponse().getCookies();
        String csrf = getCookieValue(cartResult.getResponse(), "bb_csrf");

        // Apply first coupon — should succeed
        mockMvc.perform(post("/api/v1/cart/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + code1 + "\"}")
                        .cookie(cookies)
                        .header("X-CSRF-Token", csrf))
                .andExpect(status().isOk());

        // Apply second coupon — must be rejected
        mockMvc.perform(post("/api/v1/cart/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + code2 + "\"}")
                        .cookie(cookies)
                        .header("X-CSRF-Token", csrf))
                .andExpect(status().isConflict());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE C — Batch update settings
    // ══════════════════════════════════════════════════════════════════════════

    // PC1. All valid → 200, both settings updated atomically
    @Test
    void adminSettings_batchUpdate_allValid_succeeds() throws Exception {
        createTestSetting("site_name", "OldBike", "general", true);
        createTestSetting("contact_address", "123 Old St", "contact", true);

        mockMvc.perform(patch("/api/v1/admin/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"updates":[
                                  {"key":"site_name","value":"BigBike"},
                                  {"key":"contact_address","value":"456 New St"}
                                ]}
                                """)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].settingKey").value("site_name"))
                .andExpect(jsonPath("$.data[0].settingValue").value("BigBike"))
                .andExpect(jsonPath("$.data[1].settingKey").value("contact_address"))
                .andExpect(jsonPath("$.data[1].settingValue").value("456 New St"));
    }

    // PC2. One invalid value → 400, no settings changed (all-or-nothing)
    @Test
    void adminSettings_batchUpdate_oneInvalid_rollsBack() throws Exception {
        createTestSetting("contact_email", "original@bigbike.vn", "contact", true);

        mockMvc.perform(patch("/api/v1/admin/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"updates":[
                                  {"key":"contact_email","value":"not-an-email"}
                                ]}
                                """)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());

        // Value must be unchanged
        mockMvc.perform(get("/api/v1/admin/settings/contact_email")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.settingValue").value("original@bigbike.vn"));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE B.1 — Google Maps allowlist + audit log masking
    // ══════════════════════════════════════════════════════════════════════════

    // PB.1 Non-Google host → 400
    @Test
    void adminSettings_googleMapsUrl_nonGoogle_returns400() throws Exception {
        createTestSetting("google_maps_url", "https://www.google.com/maps/embed", "contact", true);

        mockMvc.perform(patch("/api/v1/admin/settings/google_maps_url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"https://evil.com/maps/embed\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // PB.2 Valid Google Maps URL → 200
    @Test
    void adminSettings_googleMapsUrl_googleMaps_succeeds() throws Exception {
        createTestSetting("google_maps_url", "https://www.google.com/maps/embed", "contact", true);

        mockMvc.perform(patch("/api/v1/admin/settings/google_maps_url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"https://www.google.com/maps/embed?pb=abc\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    // PB.3 google.com.evil.com (subdomain hijack) → 400
    @Test
    void adminSettings_googleMapsUrl_googleComEvil_returns400() throws Exception {
        createTestSetting("google_maps_url", "https://www.google.com/maps/embed", "contact", true);

        mockMvc.perform(patch("/api/v1/admin/settings/google_maps_url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"https://www.google.com.evil.com/maps/embed\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // PB.4 PATCH sensitive key → audit log records "********" not plaintext
    @Test
    void adminSettings_auditLog_masksSensitiveValue() throws Exception {
        String key = "stripe.api_key.audit." + UUID.randomUUID().toString().substring(0, 6);
        String plaintext = "sk_live_SUPER_SECRET_VALUE";
        SiteSettingEntity setting = createTestSetting(key, plaintext, "payment", false);

        mockMvc.perform(patch("/api/v1/admin/settings/" + key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"sk_live_NEW_SECRET_VALUE\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        java.util.List<AuditLogEntity> logs =
                auditLogRepo.findByResourceTypeAndResourceId("SITE_SETTING", setting.getId());
        assertThat(logs).isNotEmpty();
        AuditLogEntity log = logs.get(logs.size() - 1);
        assertThat(log.getBeforeData()).contains("********");
        assertThat(log.getBeforeData()).doesNotContain(plaintext);
        assertThat(log.getAfterData()).contains("********");
        assertThat(log.getAfterData()).doesNotContain("sk_live_NEW_SECRET_VALUE");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    private void ensureShopManagerUser(String email, String pass) {
        adminUserRepo.findByEmail(email).orElseGet(() -> {
            AdminUserEntity sm = new AdminUserEntity();
            sm.setEmail(email);
            sm.setPasswordHash(passwordService.hash(pass));
            sm.setDisplayName("Phase1J SHOP_MANAGER");
            sm.setRole("SHOP_MANAGER");
            sm.setStatus("ACTIVE");
            Instant now = Instant.now();
            sm.setCreatedAt(now);
            sm.setUpdatedAt(now);
            return adminUserRepo.save(sm);
        });
    }

    private String loginAdminUser(String email, String pass) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + pass + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return extractJsonValue(result.getResponse().getContentAsString(), "accessToken");
    }

    private void ensureAdminUser() {
        adminUserRepo.findByEmail(ADMIN_EMAIL).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(ADMIN_EMAIL);
            admin.setPasswordHash(passwordService.hash(ADMIN_PASS));
            admin.setDisplayName("Phase1J Test Admin");
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

    private CouponEntity createTestCoupon(String code) {
        String upperCode = code.toUpperCase();
        return couponRepo.findByCode(upperCode).orElseGet(() -> {
            CouponEntity c = new CouponEntity();
            c.setCode(upperCode);
            c.setName("Test Coupon " + upperCode);
            c.setDiscountType("FIXED");
            c.setAmount(new BigDecimal("10000"));
            c.setUsageCount(0);
            c.setStatus("ACTIVE");
            c.setExpiresAt(Instant.now().plus(30, ChronoUnit.DAYS));
            Instant now = Instant.now();
            c.setCreatedAt(now);
            c.setUpdatedAt(now);
            return couponRepo.save(c);
        });
    }

    private CouponEntity createCouponWithAmount(String code, String discountType, BigDecimal amount) {
        String upperCode = code.toUpperCase();
        CouponEntity c = new CouponEntity();
        c.setCode(upperCode);
        c.setName("Test Coupon " + upperCode);
        c.setDiscountType(discountType);
        c.setAmount(amount);
        c.setUsageCount(0);
        c.setStatus("ACTIVE");
        c.setExpiresAt(Instant.now().plus(30, ChronoUnit.DAYS));
        Instant now = Instant.now();
        c.setCreatedAt(now);
        c.setUpdatedAt(now);
        return couponRepo.save(c);
    }

    private CouponEntity createCouponWithStatus(String code, String status) {
        String upperCode = code.toUpperCase();
        CouponEntity c = new CouponEntity();
        c.setCode(upperCode);
        c.setName("Test Coupon " + upperCode);
        c.setDiscountType("FIXED");
        c.setAmount(new BigDecimal("10000"));
        c.setUsageCount(0);
        c.setStatus(status);
        c.setExpiresAt(Instant.now().plus(30, ChronoUnit.DAYS));
        Instant now = Instant.now();
        c.setCreatedAt(now);
        c.setUpdatedAt(now);
        return couponRepo.save(c);
    }

    private CouponEntity createExpiredCoupon(String code) {
        String upperCode = code.toUpperCase();
        CouponEntity c = new CouponEntity();
        c.setCode(upperCode);
        c.setName("Expired Coupon " + upperCode);
        c.setDiscountType("FIXED");
        c.setAmount(new BigDecimal("10000"));
        c.setUsageCount(0);
        c.setStatus("ACTIVE");
        c.setExpiresAt(Instant.now().minus(1, ChronoUnit.DAYS));
        Instant now = Instant.now();
        c.setCreatedAt(now);
        c.setUpdatedAt(now);
        return couponRepo.save(c);
    }

    private String getCookieValue(MockHttpServletResponse response, String name) {
        Cookie cookie = response.getCookie(name);
        return cookie != null ? cookie.getValue() : null;
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
