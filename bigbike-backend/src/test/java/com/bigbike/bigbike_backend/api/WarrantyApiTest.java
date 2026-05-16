package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.domain.catalog.ProductSerialStatus;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSerialEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.warranty.WarrantyRecordEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductSerialJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.warranty.WarrantyRecordJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import java.time.Instant;
import java.time.LocalDate;
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
 * Covers FULL-12 batch 3: warranty lookup (public, no auth) and admin warranty void
 * (requires warranty.write, idempotency 409 on double-void).
 * Endpoints: GET /api/v1/warranties/lookup, PATCH /api/v1/admin/warranties/{id}/void.
 * Serial + warranty records are created directly via repositories in @BeforeEach
 * using product prod_ls2_ff800 from test seed.
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class WarrantyApiTest {

    private static final String ADMIN_EMAIL  = "warr-admin-"  + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS   = "Admin@Warr1234";
    private static final String EDITOR_EMAIL = "warr-editor-" + UUID.randomUUID() + "@bigbike.test";
    private static final String EDITOR_PASS  = "Editor@Warr1234";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired PasswordService passwordService;
    @Autowired ProductJpaRepository productRepo;
    @Autowired ProductSerialJpaRepository serialRepo;
    @Autowired WarrantyRecordJpaRepository warrantyRepo;

    private MockMvc mockMvc;
    private String adminToken;
    private String editorToken;
    private String serialNumber;
    private UUID warrantyId;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureAdminUser(ADMIN_EMAIL, ADMIN_PASS, "ADMIN");
        ensureAdminUser(EDITOR_EMAIL, EDITOR_PASS, "EDITOR");
        adminToken  = loginAdmin(ADMIN_EMAIL, ADMIN_PASS);
        editorToken = loginAdmin(EDITOR_EMAIL, EDITOR_PASS);

        // Each test gets a fresh serial + warranty to avoid state bleed between tests.
        var product = productRepo.findById("prod_ls2_ff800").orElseThrow();
        serialNumber = "SN-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();

        Instant now = Instant.now();
        ProductSerialEntity serial = new ProductSerialEntity();
        serial.setProduct(product);
        serial.setSerialNumber(serialNumber);
        serial.setStatus(ProductSerialStatus.IN_STOCK);
        serial.setReceivedAt(now);
        serial.setCreatedAt(now);
        serial.setUpdatedAt(now);
        ProductSerialEntity savedSerial = serialRepo.save(serial);

        WarrantyRecordEntity warranty = new WarrantyRecordEntity();
        warranty.setSerialId(savedSerial.getId());
        warranty.setStartDate(LocalDate.now().minusMonths(6));
        warranty.setEndDate(LocalDate.now().plusMonths(18));
        warranty.setStatus("ACTIVE");
        warranty.setCreatedAt(now);
        warranty.setUpdatedAt(now);
        warrantyId = warrantyRepo.save(warranty).getId();
    }

    // ── 1. Public lookup ───────────────────────────────────────────────────────

    @Test
    void lookupWarranty_validSerial_returns200WithDetails() throws Exception {
        mockMvc.perform(get("/api/v1/warranties/lookup")
                        .param("serial", serialNumber))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.serialNumber").value(serialNumber))
                .andExpect(jsonPath("$.data.productName").isNotEmpty())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.daysLeft").isNumber());
    }

    @Test
    void lookupWarranty_unknownSerial_returns404() throws Exception {
        mockMvc.perform(get("/api/v1/warranties/lookup")
                        .param("serial", "SERIAL-NOTFOUND-" + UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    // ── 2. Admin void — permission gates ──────────────────────────────────────

    @Test
    void voidWarranty_noToken_returns401() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/warranties/" + warrantyId + "/void"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void voidWarranty_editorLacksWarrantyWrite_returns403() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/warranties/" + warrantyId + "/void")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    // ── 3. Admin void — happy path ─────────────────────────────────────────────

    @Test
    void voidWarranty_valid_returns200WithVoidedStatus() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/warranties/" + warrantyId + "/void")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("VOIDED"));
    }

    // ── 4. Double void → 409 ──────────────────────────────────────────────────

    @Test
    void voidWarranty_alreadyVoided_returns409() throws Exception {
        // Step 1: void → 200
        mockMvc.perform(patch("/api/v1/admin/warranties/" + warrantyId + "/void")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // Step 2: void again → 409 (ConflictException: already voided)
        mockMvc.perform(patch("/api/v1/admin/warranties/" + warrantyId + "/void")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void ensureAdminUser(String email, String password, String role) {
        adminUserRepo.findByEmail(email).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(email);
            admin.setPasswordHash(passwordService.hash(password));
            admin.setDisplayName("Warranty Test " + role);
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
        String json = result.getResponse().getContentAsString();
        String marker = "\"accessToken\":\"";
        int start = json.indexOf(marker);
        if (start < 0) throw new IllegalStateException("accessToken not found");
        start += marker.length();
        int end = json.indexOf("\"", start);
        return json.substring(start, end);
    }
}
