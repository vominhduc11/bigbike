package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.shipping.ShippingMethodJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.shipping.ShippingZoneJpaRepository;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Phase 1 Shipping API tests — zone/method CRUD, validation, permission guards.
 *
 * Seed zones/methods come from V1001 (or test-seed.sql); all mutating tests create their
 * own isolated data so they don't collide with each other.
 */
@SpringBootTest
@org.springframework.test.context.jdbc.Sql(
        scripts = "/db/test-seed.sql",
        executionPhase = org.springframework.test.context.jdbc.Sql.ExecutionPhase.BEFORE_TEST_CLASS
)
class AdminShippingApiTest {

    private static final String ADMIN_EMAIL = "ship-admin-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS  = "Admin@Ship12345";

    // SHOP_MANAGER has shipping.read but NOT shipping.write
    private static final String READER_EMAIL = "ship-reader-" + UUID.randomUUID() + "@bigbike.test";
    private static final String READER_PASS  = "Reader@Ship12345";

    private static final String SEED_ZONE_ID   = "00000000-0000-0000-0000-000000000301";
    private static final String SEED_COD_ID    = "00000000-0000-0000-0000-000000000401";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired ShippingZoneJpaRepository shippingZoneRepo;
    @Autowired ShippingMethodJpaRepository shippingMethodRepo;
    @Autowired PasswordService passwordService;

    private MockMvc mockMvc;
    private String adminToken;
    private String readerToken;

    // Track all zones created by this test class so they (and their methods) are deleted after each test.
    private final List<String> createdZoneIds = new ArrayList<>();

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureAdminUser(ADMIN_EMAIL, ADMIN_PASS, "ADMIN");
        ensureAdminUser(READER_EMAIL, READER_PASS, "SHOP_MANAGER");
        adminToken  = loginAdmin(ADMIN_EMAIL, ADMIN_PASS);
        readerToken = loginAdmin(READER_EMAIL, READER_PASS);
    }

    @org.junit.jupiter.api.AfterEach
    void cleanupCreatedZones() {
        // Cascade deletes all methods in these zones; safe to call even if already deleted by a test.
        for (String zoneId : createdZoneIds) {
            shippingZoneRepo.findById(UUID.fromString(zoneId)).ifPresent(zone -> {
                shippingMethodRepo.deleteAll(shippingMethodRepo.findByZoneId(UUID.fromString(zoneId)));
                shippingZoneRepo.delete(zone);
            });
        }
        createdZoneIds.clear();
    }

    // ── Permission guards ─────────────────────────────────────────────────────

    // 1. No token → 401 on read
    @Test
    void listZones_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/shipping/zones"))
                .andExpect(status().isUnauthorized());
    }

    // 2. No token → 401 on write
    @Test
    void createZone_noAuth_returns401() throws Exception {
        mockMvc.perform(post("/api/v1/admin/shipping/zones")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Test Zone\"}"))
                .andExpect(status().isUnauthorized());
    }

    // 3. SHOP_MANAGER has shipping.read → read endpoint returns 200 (URL gate is authenticated() now)
    @Test
    void listZones_readerRole_returns200() throws Exception {
        mockMvc.perform(get("/api/v1/admin/shipping/zones")
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk());
    }

    // 4. SHOP_MANAGER cannot create zone → 403
    @Test
    void createZone_readerRole_returns403() throws Exception {
        mockMvc.perform(post("/api/v1/admin/shipping/zones")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Forbidden Zone\"}")
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isForbidden());
    }

    // 5. SHOP_MANAGER cannot create method → 403
    @Test
    void createMethod_readerRole_returns403() throws Exception {
        mockMvc.perform(post("/api/v1/admin/shipping/zones/" + SEED_ZONE_ID + "/methods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"methodCode\":\"test\",\"title\":\"Test\"}")
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isForbidden());
    }

    // ── Zone CRUD happy paths ─────────────────────────────────────────────────

    // 6. List zones returns seeded data
    @Test
    void listZones_adminToken_returnsSeededZone() throws Exception {
        mockMvc.perform(get("/api/v1/admin/shipping/zones")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.pagination.page").value(1));
    }

    // 7. Get zone by id
    @Test
    void getZone_seededZone_returnsData() throws Exception {
        mockMvc.perform(get("/api/v1/admin/shipping/zones/" + SEED_ZONE_ID)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(SEED_ZONE_ID))
                .andExpect(jsonPath("$.data.name").value("Vietnam"));
    }

    // 8. Create zone
    @Test
    void createZone_validPayload_returns200AndPersists() throws Exception {
        String zoneName = "Zone-" + UUID.randomUUID().toString().substring(0, 8);

        MvcResult result = mockMvc.perform(post("/api/v1/admin/shipping/zones")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + zoneName + "\",\"regionCode\":\"HCM\",\"sortOrder\":5,\"enabled\":true}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value(zoneName))
                .andExpect(jsonPath("$.data.regionCode").value("HCM"))
                .andExpect(jsonPath("$.data.id").isString())
                .andReturn();

        String zoneId = extractJsonValue(result.getResponse().getContentAsString(), "id");
        createdZoneIds.add(zoneId);
        assertThat(zoneId).isNotBlank();
    }

    // 9. Patch zone name
    @Test
    void patchZone_name_updates() throws Exception {
        String zoneId = createZoneAndGetId("PatchMe-" + UUID.randomUUID().toString().substring(0, 6));
        String newName = "PatchedName-" + UUID.randomUUID().toString().substring(0, 6);

        mockMvc.perform(patch("/api/v1/admin/shipping/zones/" + zoneId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + newName + "\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value(newName));
    }

    // 10. Patch zone — clear regionCode by sending null
    @Test
    void patchZone_clearRegionCode_setsToNull() throws Exception {
        String zoneId = createZoneWithRegionAndGetId("RegionZone-" + UUID.randomUUID().toString().substring(0, 6), "VN");

        mockMvc.perform(patch("/api/v1/admin/shipping/zones/" + zoneId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"regionCode\":null}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.regionCode").value(""));
    }

    // 11. Delete zone
    @Test
    void deleteZone_existingZone_returns204() throws Exception {
        String zoneId = createZoneAndGetId("ToDelete-" + UUID.randomUUID().toString().substring(0, 6));

        mockMvc.perform(delete("/api/v1/admin/shipping/zones/" + zoneId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/admin/shipping/zones/" + zoneId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
    }

    // ── Method CRUD happy paths ───────────────────────────────────────────────

    // 12. List methods for seeded zone
    @Test
    void listMethods_seededZone_returnsMethods() throws Exception {
        mockMvc.perform(get("/api/v1/admin/shipping/zones/" + SEED_ZONE_ID + "/methods")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    // 13. Create method
    @Test
    void createMethod_validPayload_returns200AndPersists() throws Exception {
        String code = "testcode-" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        String zoneId = createZoneAndGetId("MethodZone-" + UUID.randomUUID().toString().substring(0, 6));

        mockMvc.perform(post("/api/v1/admin/shipping/zones/" + zoneId + "/methods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"methodCode\":\"" + code + "\",\"title\":\"Test Method\"," +
                                 "\"cost\":30000,\"minOrderAmount\":0,\"sortOrder\":0,\"enabled\":true}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.methodCode").value(code))
                .andExpect(jsonPath("$.data.cost").value(30000))
                .andExpect(jsonPath("$.data.id").isString());
    }

    // 14. Patch method — update cost
    @Test
    void patchMethod_cost_updates() throws Exception {
        String zoneId = createZoneAndGetId("PatchMethodZone-" + UUID.randomUUID().toString().substring(0, 6));
        String methodId = createMethodAndGetId(zoneId, "pm-cost-" + UUID.randomUUID().toString().replace("-", "").substring(0, 6), "Patch Cost Method");

        mockMvc.perform(patch("/api/v1/admin/shipping/zones/" + zoneId + "/methods/" + methodId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cost\":99000}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.cost").value(99000));
    }

    // 15. Patch method — clear freeShippingThreshold by sending null
    @Test
    void patchMethod_clearFreeShippingThreshold_setsToNull() throws Exception {
        String zoneId = createZoneAndGetId("FSTZone-" + UUID.randomUUID().toString().substring(0, 6));
        String code = "fst-" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        MvcResult create = mockMvc.perform(post("/api/v1/admin/shipping/zones/" + zoneId + "/methods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"methodCode\":\"" + code + "\",\"title\":\"FST Method\"," +
                                 "\"cost\":10000,\"freeShippingThreshold\":500000}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        String methodId = extractJsonValue(create.getResponse().getContentAsString(), "id");

        mockMvc.perform(patch("/api/v1/admin/shipping/zones/" + zoneId + "/methods/" + methodId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"freeShippingThreshold\":null}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                // field is present but null in JSON — Jackson serializes null map entries by default
                .andExpect(jsonPath("$.data.freeShippingThreshold").value(nullValue()));
    }

    // 16. Delete method
    @Test
    void deleteMethod_existingMethod_returns204() throws Exception {
        String zoneId = createZoneAndGetId("DelMethodZone-" + UUID.randomUUID().toString().substring(0, 6));
        String methodId = createMethodAndGetId(zoneId, "dm-" + UUID.randomUUID().toString().replace("-", "").substring(0, 6), "Delete Method");

        mockMvc.perform(delete("/api/v1/admin/shipping/zones/" + zoneId + "/methods/" + methodId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());
    }

    // ── Validation 400s ───────────────────────────────────────────────────────

    // 17. Create zone with blank name → 400
    @Test
    void createZone_blankName_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/admin/shipping/zones")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 18. Create zone with missing name → 400
    @Test
    void createZone_missingName_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/admin/shipping/zones")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"regionCode\":\"VN\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 19. Create method with missing methodCode → 400
    @Test
    void createMethod_missingMethodCode_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/admin/shipping/zones/" + SEED_ZONE_ID + "/methods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Missing Code\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 20. Create method with blank title → 400
    @Test
    void createMethod_blankTitle_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/admin/shipping/zones/" + SEED_ZONE_ID + "/methods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"methodCode\":\"valid-code\",\"title\":\"\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 21. Create method with invalid methodCode pattern (uppercase) → 400
    @Test
    void createMethod_invalidMethodCodePattern_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/admin/shipping/zones/" + SEED_ZONE_ID + "/methods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"methodCode\":\"INVALID_UPPER\",\"title\":\"Test\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 22. Create method with negative cost → 400
    @Test
    void createMethod_negativeCost_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/admin/shipping/zones/" + SEED_ZONE_ID + "/methods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"methodCode\":\"neg-cost\",\"title\":\"Neg Cost\",\"cost\":-1}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 23. Create method with negative minOrderAmount → 400
    @Test
    void createMethod_negativeMinOrderAmount_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/admin/shipping/zones/" + SEED_ZONE_ID + "/methods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"methodCode\":\"neg-min\",\"title\":\"Neg Min\",\"minOrderAmount\":-100}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 24. Create method with negative freeShippingThreshold → 400
    @Test
    void createMethod_negativeFreeShippingThreshold_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/admin/shipping/zones/" + SEED_ZONE_ID + "/methods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"methodCode\":\"neg-fst\",\"title\":\"Neg FST\",\"freeShippingThreshold\":-50}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 25. Patch method with negative cost → 400
    @Test
    void patchMethod_negativeCost_returns400() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/shipping/zones/" + SEED_ZONE_ID + "/methods/" + SEED_COD_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cost\":-500}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 26. Patch zone with blank name → 400
    @Test
    void patchZone_blankName_returns400() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/shipping/zones/" + SEED_ZONE_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // 27. Get non-existent zone → 404
    @Test
    void getZone_nonExistent_returns404() throws Exception {
        mockMvc.perform(get("/api/v1/admin/shipping/zones/" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void ensureAdminUser(String email, String password, String role) {
        adminUserRepo.findByEmail(email).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(email);
            admin.setPasswordHash(passwordService.hash(password));
            admin.setDisplayName("Shipping Test " + role);
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

    private String createZoneAndGetId(String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/shipping/zones")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        String id = extractJsonValue(result.getResponse().getContentAsString(), "id");
        createdZoneIds.add(id);
        return id;
    }

    private String createZoneWithRegionAndGetId(String name, String regionCode) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/shipping/zones")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\",\"regionCode\":\"" + regionCode + "\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        String id = extractJsonValue(result.getResponse().getContentAsString(), "id");
        createdZoneIds.add(id);
        return id;
    }

    private String createMethodAndGetId(String zoneId, String methodCode, String title) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/shipping/zones/" + zoneId + "/methods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"methodCode\":\"" + methodCode + "\",\"title\":\"" + title + "\",\"cost\":0}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        return extractJsonValue(result.getResponse().getContentAsString(), "id");
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
