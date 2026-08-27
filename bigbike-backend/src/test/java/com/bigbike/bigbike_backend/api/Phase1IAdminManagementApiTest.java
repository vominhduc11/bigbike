package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import jakarta.servlet.http.Cookie;
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
class Phase1IAdminManagementApiTest {

    private static final String ADMIN_EMAIL = "1i-admin-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS  = "Admin@1I2345678";

    private static final String VALID_BILLING = """
            {"fullName":"Test User","phone":"0909000001","email":"tuser@example.com",
             "addressLine1":"1 Test Rd","province":"HCM","ward":"Phuong 1","country":"VN"}
            """;

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired CustomerJpaRepository customerRepo;
    @Autowired AuditLogJpaRepository auditLogRepo;
    @Autowired MediaJpaRepository mediaRepo;
    @Autowired ProductJpaRepository productRepo;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired PasswordService passwordService;

    private MockMvc mockMvc;
    private String adminToken;
    private static String testCategoryId;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureAdminUser();
        adminToken = loginAdmin();
        ensureTestCategory();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CUSTOMER TESTS (1–8)
    // ══════════════════════════════════════════════════════════════════════════

    // 1. No auth → 401
    @Test
    void adminCustomers_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/customers"))
                .andExpect(status().isUnauthorized());
    }

    // 2. Authenticated → list returned
    @Test
    void adminCustomers_withAdminToken_returnsList() throws Exception {
        createTestCustomer("cust-list-" + UUID.randomUUID() + "@bigbike.test");

        mockMvc.perform(get("/api/v1/admin/customers")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.pagination.page").value(1));
    }

    // 3. Search by email works
    @Test
    void adminCustomers_searchByEmailWorks() throws Exception {
        String uniqueEmail = "srch-" + UUID.randomUUID() + "@bigbike.test";
        createTestCustomer(uniqueEmail);

        String prefix = uniqueEmail.substring(0, 10);
        MvcResult result = mockMvc.perform(get("/api/v1/admin/customers")
                        .param("q", prefix)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(result.getResponse().getContentAsString()).contains(uniqueEmail);

        // Non-matching query → empty
        mockMvc.perform(get("/api/v1/admin/customers")
                        .param("q", "NOMATCH-" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    // 4. Detail includes addresses and order summary
    @Test
    void adminCustomerDetail_returnsAddressesAndOrderSummary() throws Exception {
        // Register customer to get a real customer entity with address
        String email = "det-" + UUID.randomUUID() + "@bigbike.test";
        registerAndLoginCustomer(email);

        // Find the customer UUID via list
        MvcResult listResult = mockMvc.perform(get("/api/v1/admin/customers")
                        .param("q", email)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();

        String listBody = listResult.getResponse().getContentAsString();
        String customerId = extractFirstId(listBody);
        assertThat(customerId).isNotNull();

        mockMvc.perform(get("/api/v1/admin/customers/" + customerId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value(email))
                .andExpect(jsonPath("$.data.addresses").isArray())
                .andExpect(jsonPath("$.data.orderSummary").exists())
                .andExpect(jsonPath("$.data.orderSummary.orderCount").isNumber());
    }

    // 5. Update the two admin-editable customer profile fields
    @Test
    void updateCustomer_updatesBasicInfo() throws Exception {
        String email = "upd-" + UUID.randomUUID() + "@bigbike.test";
        UUID customerId = createTestCustomer(email);
        String phone = "09" + String.format(
                "%08d", Math.floorMod(UUID.randomUUID().hashCode(), 100_000_000));

        mockMvc.perform(patch("/api/v1/admin/customers/" + customerId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Updated Name\",\"phone\":\"" + phone + "\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.displayName").value("Updated Name"))
                .andExpect(jsonPath("$.data.phone").value(phone));
    }

    // 6. Admin API keeps account-identity fields read-only
    @Test
    void updateCustomer_emailIsReadOnly_returns400() throws Exception {
        String emailA = "dup-a-" + UUID.randomUUID() + "@bigbike.test";
        String emailB = "dup-b-" + UUID.randomUUID() + "@bigbike.test";
        UUID customerA = createTestCustomer(emailA);
        createTestCustomer(emailB);

        mockMvc.perform(patch("/api/v1/admin/customers/" + customerA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + emailB + "\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[?(@.field == 'email')]").exists());
    }

    @Test
    void updateCustomer_blankPhone_clearsStoredPhone() throws Exception {
        UUID customerId = createTestCustomer("phone-clear-" + UUID.randomUUID() + "@bigbike.test");
        CustomerEntity customer = customerRepo.findById(customerId).orElseThrow();
        customer.setPhone("0901234567");
        customerRepo.saveAndFlush(customer);

        mockMvc.perform(patch("/api/v1/admin/customers/" + customerId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        assertThat(customerRepo.findById(customerId).orElseThrow().getPhone()).isNull();
    }

    @Test
    void updateCustomer_invalidPhone_returnsFieldValidationError() throws Exception {
        UUID customerId = createTestCustomer("phone-invalid-" + UUID.randomUUID() + "@bigbike.test");

        mockMvc.perform(patch("/api/v1/admin/customers/" + customerId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"not-a-phone\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[?(@.field == 'phone')]").exists());
    }

    // 7. Update customer status — disables customer
    @Test
    void updateCustomerStatus_disablesCustomer() throws Exception {
        UUID customerId = createTestCustomer("stat-" + UUID.randomUUID() + "@bigbike.test");

        mockMvc.perform(patch("/api/v1/admin/customers/" + customerId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DISABLED\",\"reason\":\"Spam account\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DISABLED"));
    }

    // 8. Customer mutation writes audit log
    @Test
    void customerMutation_writesAuditLog() throws Exception {
        UUID customerId = createTestCustomer("aud-" + UUID.randomUUID() + "@bigbike.test");

        // Updating displayName should write audit without error
        mockMvc.perform(patch("/api/v1/admin/customers/" + customerId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Audit Test\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // Status update should also audit
        mockMvc.perform(patch("/api/v1/admin/customers/" + customerId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ACTIVE\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    // 8b. synthetic=true/false filters on isSynthetic (WordPress guest-order migration flag)
    @Test
    void adminCustomers_filterBySyntheticWorks() throws Exception {
        String realEmail = "synth-real-" + UUID.randomUUID() + "@bigbike.test";
        String syntheticEmail = "synth-flag-" + UUID.randomUUID() + "@bigbike.test";
        createTestCustomer(realEmail, false);
        createTestCustomer(syntheticEmail, true);

        MvcResult syntheticResult = mockMvc.perform(get("/api/v1/admin/customers")
                        .param("synthetic", "true")
                        .param("q", syntheticEmail)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(syntheticResult.getResponse().getContentAsString()).contains(syntheticEmail);

        mockMvc.perform(get("/api/v1/admin/customers")
                        .param("synthetic", "false")
                        .param("q", syntheticEmail)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    // 8c. Optional status-change reason is persisted only in the audit log, not on the customer row
    @Test
    void updateCustomerStatus_reason_isWrittenToAuditLog() throws Exception {
        UUID customerId = createTestCustomer("reason-aud-" + UUID.randomUUID() + "@bigbike.test");
        String reason = "Khách hàng báo cáo gian lận thanh toán";

        mockMvc.perform(patch("/api/v1/admin/customers/" + customerId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"BLOCKED\",\"reason\":\"" + reason + "\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("BLOCKED"));

        boolean hasReasonInAudit = auditLogRepo.findAll().stream()
                .filter(a -> "CUSTOMER_STATUS_UPDATED".equals(a.getAction()))
                .filter(a -> customerId.equals(a.getResourceId()))
                .anyMatch(a -> a.getAfterData() != null && a.getAfterData().contains(reason));
        assertThat(hasReasonInAudit).isTrue();
    }

    // 8d. Admin avatar removal — deletes + nulls, idempotent when already unset
    @Test
    void removeCustomerAvatar_nullsAvatarAndIsIdempotent() throws Exception {
        UUID customerId = createTestCustomer("avatar-" + UUID.randomUUID() + "@bigbike.test");
        CustomerEntity customer = customerRepo.findById(customerId).orElseThrow();
        customer.setAvatarUrl("/media/customers/" + customerId + "/test-uuid/avatar.jpg");
        customerRepo.saveAndFlush(customer);

        mockMvc.perform(delete("/api/v1/admin/customers/" + customerId + "/avatar")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.avatarUrl").doesNotExist());
        assertThat(customerRepo.findById(customerId).orElseThrow().getAvatarUrl()).isNull();

        // Calling again with no avatar set is a no-op 200, not a 404.
        mockMvc.perform(delete("/api/v1/admin/customers/" + customerId + "/avatar")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MEDIA TESTS (9–15)
    // ══════════════════════════════════════════════════════════════════════════

    // 9. No auth → 401
    @Test
    void adminMedia_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/media"))
                .andExpect(status().isUnauthorized());
    }

    // 10. Authenticated → list works
    @Test
    void adminMedia_listWorks() throws Exception {
        createTestMedia("image/jpeg", "ACTIVE");

        mockMvc.perform(get("/api/v1/admin/media")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.pagination.page").value(1));
    }

    // 11. Filter by mimeType works
    @Test
    void adminMedia_filterByMimeTypeWorks() throws Exception {
        createTestMedia("image/png", "ACTIVE");

        mockMvc.perform(get("/api/v1/admin/media")
                        .param("mimeType", "image/png")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());

        // Non-matching mimeType → empty
        mockMvc.perform(get("/api/v1/admin/media")
                        .param("mimeType", "video/mpeg")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    // 12. Detail works
    @Test
    void adminMedia_detailWorks() throws Exception {
        UUID mediaId = createTestMedia("image/jpeg", "ACTIVE");

        mockMvc.perform(get("/api/v1/admin/media/" + mediaId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(mediaId.toString()))
                .andExpect(jsonPath("$.data.mimeType").value("image/jpeg"))
                .andExpect(jsonPath("$.data.storageProvider").exists());
    }

    // 13. Update metadata — altText, title
    @Test
    void updateMedia_updatesAltTitle() throws Exception {
        UUID mediaId = createTestMedia("image/webp", "ACTIVE");

        mockMvc.perform(patch("/api/v1/admin/media/" + mediaId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"altText\":\"Mũ bảo hiểm AGV\",\"title\":\"AGV K1\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.altText").value("Mũ bảo hiểm AGV"))
                .andExpect(jsonPath("$.data.title").value("AGV K1"));
    }

    // 14. Delete marks status=DELETED (logical delete)
    @Test
    void deleteMedia_marksDeleted() throws Exception {
        UUID mediaId = createTestMedia("image/gif", "ACTIVE");

        mockMvc.perform(delete("/api/v1/admin/media/" + mediaId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        // Verify deleted status via detail
        mockMvc.perform(get("/api/v1/admin/media/" + mediaId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DELETED"));
    }

    // 15. Media mutations write audit log
    @Test
    void mediaMutation_writesAuditLog() throws Exception {
        UUID mediaId = createTestMedia("image/jpeg", "ACTIVE");

        mockMvc.perform(patch("/api/v1/admin/media/" + mediaId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"altText\":\"Audit alt\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/v1/admin/media/" + mediaId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // REGRESSION TESTS (16–22)
    // ══════════════════════════════════════════════════════════════════════════

    // 26. Admin orders still work
    @Test
    void adminOrders_stillWork() throws Exception {
        mockMvc.perform(get("/api/v1/admin/orders")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    // 27. Customer orders still protected
    @Test
    void customerOrders_stillProtected() throws Exception {
        mockMvc.perform(get("/api/v1/customer/orders"))
                .andExpect(status().isUnauthorized());
    }

    // 28. Guest order lookup still works
    @Test
    void guestOrderLookup_stillWorks() throws Exception {
        mockMvc.perform(get("/api/v1/orders/lookup")
                        .param("orderNumber", "BB-NOTEXIST-0001")
                        .param("orderKey", "bb_order_fakekey"))
                .andExpect(status().isNotFound());
    }

    // 29. Cart API still works
    @Test
    void cartApi_stillWorks() throws Exception {
        mockMvc.perform(get("/api/v1/cart"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    // 30. (checkout options regression removed 2026-07-15 — endpoint deleted per AUD-056)

    // 31. Public catalog still public
    @Test
    void publicCatalog_stillPublic() throws Exception {
        mockMvc.perform(get("/api/v1/products").param("page", "1").param("size", "2"))
                .andExpect(status().isOk());
    }

    // 32. Customer me still protected
    @Test
    void customerMe_stillWorks() throws Exception {
        String email = "regr-me-1i-" + UUID.randomUUID() + "@bigbike.vn";
        Cookie[] cookies = registerAndLoginCustomer(email);
        mockMvc.perform(get("/api/v1/customer/me").cookie(cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value(email));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    private void ensureAdminUser() {
        adminUserRepo.findByEmail(ADMIN_EMAIL).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(ADMIN_EMAIL);
            admin.setPasswordHash(passwordService.hash(ADMIN_PASS));
            admin.setDisplayName("Phase1I Test Admin");
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

    private void ensureTestCategory() {
        if (testCategoryId != null) return;
        testCategoryId = "cat-1i-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity cat = new CategoryEntity();
        cat.setId(testCategoryId);
        cat.setSlug("admin-mgmt-cat-" + testCategoryId);
        cat.setName("Admin Management Test Category");
        cat.setVisible(true);
        cat.setCreatedAt(Instant.now());
        cat.setUpdatedAt(Instant.now());
        categoryRepo.save(cat);
    }

    /** Create a minimal customer entity directly in the DB and return its UUID. */
    private UUID createTestCustomer(String email) {
        return createTestCustomer(email, false);
    }

    /** Create a minimal customer entity directly in the DB, with an explicit isSynthetic flag. */
    private UUID createTestCustomer(String email, boolean synthetic) {
        CustomerEntity c = new CustomerEntity();
        c.setEmail(email);
        c.setPasswordHash(passwordService.hash("Test@12345"));
        c.setDisplayName("Test Customer");
        c.setStatus("ACTIVE");
        c.setSynthetic(synthetic);
        Instant now = Instant.now();
        c.setCreatedAt(now);
        c.setUpdatedAt(now);
        return customerRepo.save(c).getId();
    }

    /** Register customer via API and return session cookies. */
    private Cookie[] registerAndLoginCustomer(String email) throws Exception {
        mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email
                                + "\",\"password\":\"pass1234\",\"privacyConsent\":true,\"privacyPolicyLocale\":\"vi\"}"))
                .andExpect(status().isOk());
        MvcResult loginResult = mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"pass1234\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return loginResult.getResponse().getCookies();
    }

    /** Create a minimal MediaEntity directly in the DB and return its UUID. */
    private UUID createTestMedia(String mimeType, String status) {
        MediaEntity m = new MediaEntity();
        m.setFilePath("/uploads/test-" + UUID.randomUUID() + ".jpg");
        m.setPublicUrl("https://cdn.bigbike.vn/test-image.jpg");
        m.setStorageProvider("LOCAL");
        m.setMimeType(mimeType);
        m.setFileSize(12345L);
        m.setAltText("Test image");
        m.setTitle("Test Image Title");
        m.setStatus(status);
        Instant now = Instant.now();
        m.setCreatedAt(now);
        m.setUpdatedAt(now);
        return mediaRepo.save(m).getId();
    }

    private ProductEntity createTestProduct(String name, int price) {
        Instant now = Instant.now();
        ProductEntity p = new ProductEntity();
        p.setId(UUID.randomUUID().toString());
        p.setSlug("1i-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        p.setName(name);
        p.setRetailPrice(java.math.BigDecimal.valueOf(price));
        p.setCurrency("VND");
        p.setPublishStatus(PublishStatus.PUBLISHED);
        p.setStockState(ProductStockState.IN_STOCK);
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        p.setCategory(categoryRepo.findById(testCategoryId).orElseThrow());
        return productRepo.save(p);
    }

    /** Extract 'id' from the first object in a "data" array. */
    private String extractFirstId(String json) {
        String marker = "\"id\":\"";
        // Skip to the data array content
        int dataStart = json.indexOf("\"data\":[");
        if (dataStart < 0) return null;
        int start = json.indexOf(marker, dataStart);
        if (start < 0) return null;
        start += marker.length();
        int end = json.indexOf("\"", start);
        return json.substring(start, end);
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
