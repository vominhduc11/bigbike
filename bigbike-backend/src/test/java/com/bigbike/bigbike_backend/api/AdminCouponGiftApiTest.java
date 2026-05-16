package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
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

/**
 * Covers FULL-12 batch 3: coupon gift — single gift (validate email, amount, percent),
 * bulk gift (sent/skipped counts), and permission gates (coupons.write).
 * Endpoints: POST /api/v1/admin/customers/{id}/coupon-gift,
 *            POST /api/v1/admin/coupon-gifts/bulk.
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class AdminCouponGiftApiTest {

    private static final String ADMIN_EMAIL  = "cgift-admin-"  + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS   = "Admin@CGift1234";
    private static final String EDITOR_EMAIL = "cgift-editor-" + UUID.randomUUID() + "@bigbike.test";
    private static final String EDITOR_PASS  = "Editor@CGift1234";

    private static final String VALID_GIFT_BODY =
            "{\"discountType\":\"FIXED\",\"amount\":50000,\"validDays\":30}";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired CustomerJpaRepository customerRepo;
    @Autowired PasswordService passwordService;

    private MockMvc mockMvc;
    private String adminToken;
    private String editorToken;
    private UUID customerWithEmailId;
    private UUID customerNoEmailId;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureAdminUser(ADMIN_EMAIL, ADMIN_PASS, "ADMIN");
        ensureAdminUser(EDITOR_EMAIL, EDITOR_PASS, "EDITOR");
        adminToken  = loginAdmin(ADMIN_EMAIL, ADMIN_PASS);
        editorToken = loginAdmin(EDITOR_EMAIL, EDITOR_PASS);

        Instant now = Instant.now();

        // Customer with email — target for single gift and included in bulk.
        CustomerEntity withEmail = new CustomerEntity();
        withEmail.setEmail("cgift-" + UUID.randomUUID() + "@example.com");
        withEmail.setDisplayName("Gift Customer");
        withEmail.setStatus("ACTIVE");
        withEmail.setCreatedAt(now);
        withEmail.setUpdatedAt(now);
        customerWithEmailId = customerRepo.save(withEmail).getId();

        // Customer without email — triggers 409 on single gift.
        CustomerEntity noEmail = new CustomerEntity();
        noEmail.setDisplayName("No Email Customer");
        noEmail.setStatus("ACTIVE");
        noEmail.setCreatedAt(now);
        noEmail.setUpdatedAt(now);
        customerNoEmailId = customerRepo.save(noEmail).getId();
    }

    // ── 1. Auth gates ──────────────────────────────────────────────────────────

    @Test
    void sendSingleCouponGift_noToken_returns401() throws Exception {
        mockMvc.perform(post("/api/v1/admin/customers/" + customerWithEmailId + "/coupon-gift")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_GIFT_BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void sendSingleCouponGift_editorLacksCouponsWrite_returns403() throws Exception {
        mockMvc.perform(post("/api/v1/admin/customers/" + customerWithEmailId + "/coupon-gift")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_GIFT_BODY)
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    // ── 2. Single gift — happy path ────────────────────────────────────────────

    @Test
    void sendSingleCouponGift_validCustomer_returns201WithCouponDetail() throws Exception {
        MvcResult result = mockMvc.perform(
                        post("/api/v1/admin/customers/" + customerWithEmailId + "/coupon-gift")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(VALID_GIFT_BODY)
                                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.code").isNotEmpty())
                .andExpect(jsonPath("$.data.discountType").value("FIXED"))
                .andReturn();

        assertThat(result.getResponse().getContentAsString()).contains("\"amount\"");
    }

    // ── 3. Single gift — error cases ───────────────────────────────────────────

    @Test
    void sendSingleCouponGift_customerWithoutEmail_returns409() throws Exception {
        mockMvc.perform(post("/api/v1/admin/customers/" + customerNoEmailId + "/coupon-gift")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_GIFT_BODY)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());
    }

    @Test
    void sendSingleCouponGift_amountZero_returns400() throws Exception {
        String zeroAmount = "{\"discountType\":\"FIXED\",\"amount\":0,\"validDays\":30}";
        mockMvc.perform(post("/api/v1/admin/customers/" + customerWithEmailId + "/coupon-gift")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(zeroAmount)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void sendSingleCouponGift_percentExceeds100_returns400() throws Exception {
        String invalidPercent = "{\"discountType\":\"PERCENT\",\"amount\":150,\"validDays\":30}";
        mockMvc.perform(post("/api/v1/admin/customers/" + customerWithEmailId + "/coupon-gift")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidPercent)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // ── 4. Bulk gift ───────────────────────────────────────────────────────────

    @Test
    void sendBulkCouponGift_returns200WithSentAndSkipped() throws Exception {
        String body = "{\"discountType\":\"FIXED\",\"amount\":25000,\"validDays\":7}";

        MvcResult result = mockMvc.perform(post("/api/v1/admin/coupon-gifts/bulk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sent").isNumber())
                .andExpect(jsonPath("$.data.skipped").isNumber())
                .andReturn();

        // At minimum the customer with email created in @BeforeEach must be in sent.
        int sent = Integer.parseInt(extractJsonNumber(result.getResponse().getContentAsString(), "sent"));
        assertThat(sent).isGreaterThanOrEqualTo(1);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void ensureAdminUser(String email, String password, String role) {
        adminUserRepo.findByEmail(email).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(email);
            admin.setPasswordHash(passwordService.hash(password));
            admin.setDisplayName("CGift Test " + role);
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

    private String extractJsonNumber(String json, String key) {
        String marker = "\"" + key + "\":";
        int start = json.indexOf(marker);
        if (start < 0) return "0";
        start += marker.length();
        int end = start;
        while (end < json.length() && Character.isDigit(json.charAt(end))) end++;
        return end > start ? json.substring(start, end) : "0";
    }
}
