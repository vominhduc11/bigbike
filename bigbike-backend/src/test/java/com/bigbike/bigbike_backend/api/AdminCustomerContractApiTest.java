package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import com.bigbike.bigbike_backend.service.customer.CustomerAvatarStorageService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class AdminCustomerContractApiTest {

    private static final String ADMIN_EMAIL = "customer-contract-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASSWORD = "Customer@Contract123";
    private static final ObjectMapper OBJECT_MAPPER = JsonMapper.builder().findAndAddModules().build();

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired CustomerJpaRepository customerRepo;
    @Autowired OrderJpaRepository orderRepo;
    @Autowired AuditLogJpaRepository auditLogRepo;
    @Autowired PasswordService passwordService;
    @MockitoBean CustomerAvatarStorageService customerAvatarStorageService;

    private MockMvc mockMvc;
    private String adminToken;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureAdminUser();
        adminToken = loginAdmin();
        clearInvocations(customerAvatarStorageService);
    }

    @Test
    void listFiltersTreatSearchAsLiteralAndRejectUnknownStatus() throws Exception {
        String marker = "literal-" + UUID.randomUUID().toString().substring(0, 8);
        CustomerEntity literal = createCustomer(marker + "-verified@bigbike.test", false);
        literal.setDisplayName(marker + "%name");
        literal.setEmailVerifiedAt(Instant.now());
        customerRepo.saveAndFlush(literal);

        CustomerEntity wildcardLookalike = createCustomer(marker + "-synthetic@bigbike.test", true);
        wildcardLookalike.setDisplayName(marker + "Xname");
        wildcardLookalike.setStatus("DISABLED");
        customerRepo.saveAndFlush(wildcardLookalike);

        MvcResult literalResult = mockMvc.perform(get("/api/v1/admin/customers")
                        .param("q", marker + "%name")
                        .header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode literalItems = OBJECT_MAPPER.readTree(literalResult.getResponse().getContentAsString()).path("data");
        assertThat(literalItems).hasSize(1);
        assertThat(literalItems.get(0).path("id").asText()).isEqualTo(literal.getId().toString());

        mockMvc.perform(get("/api/v1/admin/customers")
                        .param("q", wildcardLookalike.getEmail())
                        .param("status", "disabled")
                        .param("synthetic", "true")
                        .param("emailVerified", "false")
                        .header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].id").value(wildcardLookalike.getId().toString()));

        mockMvc.perform(get("/api/v1/admin/customers")
                        .param("q", literal.getEmail())
                        .param("emailVerified", "false")
                        .header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));

        mockMvc.perform(get("/api/v1/admin/customers")
                        .param("status", "NOT_A_CUSTOMER_STATUS")
                        .header("Authorization", bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[?(@.field == 'status')]").exists());
    }

    @Test
    void profilePatchAllowsOnlyDisplayNameAndPhoneWithCanonicalPhoneSemantics() throws Exception {
        CustomerEntity customer = createCustomer("profile-" + UUID.randomUUID() + "@bigbike.test", false);
        customer.setPhone("0901234567");
        customer.setFirstName("Original First");
        customer.setLastName("Original Last");
        customerRepo.saveAndFlush(customer);

        mockMvc.perform(patch("/api/v1/admin/customers/" + customer.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Allowed Name\",\"phone\":null}")
                        .header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.displayName").value("Allowed Name"))
                .andExpect(jsonPath("$.data.phone").value("0901234567"));

        for (Map<String, ?> forbidden : List.of(
                Map.of("email", "changed-" + UUID.randomUUID() + "@bigbike.test"),
                Map.of("firstName", "Changed First"),
                Map.of("lastName", "Changed Last"))) {
            mockMvc.perform(patch("/api/v1/admin/customers/" + customer.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json(forbidden))
                            .header("Authorization", bearer()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
        }

        CustomerEntity unchanged = customerRepo.findById(customer.getId()).orElseThrow();
        assertThat(unchanged.getEmail()).isEqualTo(customer.getEmail());
        assertThat(unchanged.getFirstName()).isEqualTo("Original First");
        assertThat(unchanged.getLastName()).isEqualTo("Original Last");
        assertThat(unchanged.getPhone()).isEqualTo("0901234567");

        mockMvc.perform(patch("/api/v1/admin/customers/" + customer.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("phone", "")))
                        .header("Authorization", bearer()))
                .andExpect(status().isOk());
        assertThat(customerRepo.findById(customer.getId()).orElseThrow().getPhone()).isNull();
    }

    @Test
    void profilePatchRejectsNormalizedDuplicatePhone() throws Exception {
        CustomerEntity owner = createCustomer("phone-owner-" + UUID.randomUUID() + "@bigbike.test", false);
        owner.setPhone("0901234567");
        customerRepo.saveAndFlush(owner);
        CustomerEntity target = createCustomer("phone-target-" + UUID.randomUUID() + "@bigbike.test", false);

        mockMvc.perform(patch("/api/v1/admin/customers/" + target.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("phone", "+84901234567")))
                        .header("Authorization", bearer()))
                .andExpect(status().isConflict());

        assertThat(customerRepo.findById(target.getId()).orElseThrow().getPhone()).isNull();

        CustomerEntity formattedOwner =
                createCustomer("formatted-phone-owner-" + UUID.randomUUID() + "@bigbike.test", false);
        formattedOwner.setPhone("+84 (91).234-5678");
        customerRepo.saveAndFlush(formattedOwner);
        CustomerEntity formattedTarget =
                createCustomer("formatted-phone-target-" + UUID.randomUUID() + "@bigbike.test", false);

        mockMvc.perform(patch("/api/v1/admin/customers/" + formattedTarget.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("phone", "091-234 5678")))
                        .header("Authorization", bearer()))
                .andExpect(status().isConflict());
        assertThat(customerRepo.findById(formattedTarget.getId()).orElseThrow().getPhone()).isNull();

        CustomerEntity validFormatted =
                createCustomer("valid-formatted-" + UUID.randomUUID() + "@bigbike.test", false);
        mockMvc.perform(patch("/api/v1/admin/customers/" + validFormatted.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("phone", "(093) 456-7890")))
                        .header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.phone").value("0934567890"));

        mockMvc.perform(patch("/api/v1/admin/customers/" + validFormatted.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("phone", "093-ABC-7890")))
                        .header("Authorization", bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void syntheticCustomerAllowsProfileCorrectionButBlocksStatusTransition() throws Exception {
        CustomerEntity synthetic = createCustomer("synthetic-" + UUID.randomUUID() + "@bigbike.test", true);

        mockMvc.perform(patch("/api/v1/admin/customers/" + synthetic.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("displayName", "Corrected Guest", "phone", "0909988776")))
                        .header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.displayName").value("Corrected Guest"))
                .andExpect(jsonPath("$.data.phone").value("0909988776"));

        long statusAuditsBefore = countStatusAudits(synthetic.getId());
        mockMvc.perform(patch("/api/v1/admin/customers/" + synthetic.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("status", "ACTIVE")))
                        .header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
        assertThat(countStatusAudits(synthetic.getId())).isEqualTo(statusAuditsBefore);

        mockMvc.perform(patch("/api/v1/admin/customers/" + synthetic.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("status", "BLOCKED", "reason", "Must remain a synthetic record")))
                        .header("Authorization", bearer()))
                .andExpect(status().isConflict());
        assertThat(customerRepo.findById(synthetic.getId()).orElseThrow().getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void customerAuditSnapshotsRemainValidJsonForQuotesBackslashesAndControlCharacters() throws Exception {
        CustomerEntity customer = createCustomer("audit-json-" + UUID.randomUUID() + "@bigbike.test", false);
        String displayName = "Khách \"VIP\"\nDòng hai\\cuối\t";

        mockMvc.perform(patch("/api/v1/admin/customers/" + customer.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("displayName", displayName)))
                        .header("Authorization", bearer()))
                .andExpect(status().isOk());

        String profileAfter = latestAuditAfter("CUSTOMER_UPDATED", customer.getId());
        assertThat(OBJECT_MAPPER.readTree(profileAfter).path("displayName").asText()).isEqualTo(displayName);

        String reason = "Gian lận \"thẻ\"\nDòng hai\\cuối\t";
        mockMvc.perform(patch("/api/v1/admin/customers/" + customer.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("status", "BLOCKED", "reason", reason)))
                        .header("Authorization", bearer()))
                .andExpect(status().isOk());

        JsonNode statusAfter = OBJECT_MAPPER.readTree(latestAuditAfter("CUSTOMER_STATUS_UPDATED", customer.getId()));
        assertThat(statusAfter.path("status").asText()).isEqualTo("BLOCKED");
        assertThat(statusAfter.path("reason").asText()).isEqualTo(reason);

        mockMvc.perform(patch("/api/v1/admin/customers/" + customer.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("status", "ACTIVE", "reason", "x".repeat(1001))))
                        .header("Authorization", bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void customerPurchaseKpisExcludeCancelledOrdersButHistoryRemainsComplete() throws Exception {
        CustomerEntity customer = createCustomer("kpi-" + UUID.randomUUID() + "@bigbike.test", false);
        Instant completedAt = Instant.now().minus(3, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MICROS);
        Instant pendingAt = Instant.now().minus(2, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MICROS);
        Instant cancelledAt = Instant.now().minus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MICROS);
        createOrder(customer, "COMPLETED", new BigDecimal("4000000"), completedAt);
        createOrder(customer, "PENDING", new BigDecimal("2000000"), pendingAt);
        createOrder(customer, "CANCELLED", new BigDecimal("20000000"), cancelledAt);

        MvcResult listResult = mockMvc.perform(get("/api/v1/admin/customers")
                        .param("q", customer.getEmail())
                        .header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode listItem = OBJECT_MAPPER.readTree(listResult.getResponse().getContentAsString()).path("data").get(0);
        assertThat(listItem.path("orderCount").asInt()).isEqualTo(2);
        assertThat(listItem.path("totalSpent").decimalValue()).isEqualByComparingTo("6000000");

        MvcResult detailResult = mockMvc.perform(get("/api/v1/admin/customers/" + customer.getId())
                        .header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode summary = OBJECT_MAPPER.readTree(detailResult.getResponse().getContentAsString())
                .path("data").path("orderSummary");
        assertThat(summary.path("orderCount").asInt()).isEqualTo(2);
        assertThat(summary.path("totalSpent").decimalValue()).isEqualByComparingTo("6000000");
        assertThat(summary.path("avgOrderValue").decimalValue()).isEqualByComparingTo("3000000");
        assertThat(summary.path("segment").asText()).isEqualTo("LOYAL");
        assertThat(summary.path("latestOrders")).hasSize(3);
        assertThat(summary.path("latestOrders").findValuesAsText("status"))
                .containsExactly("CANCELLED", "PENDING", "COMPLETED");
        assertThat(summary.path("firstOrderAt").asText()).isEqualTo(completedAt.toString());
        assertThat(summary.path("lastOrderAt").asText()).isEqualTo(cancelledAt.toString());

        assertThat(orderRepo.findVipCustomerIds(new BigDecimal("10000000"))).doesNotContain(customer.getId());
        mockMvc.perform(get("/api/v1/admin/customers/summary")
                        .header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").isNumber())
                .andExpect(jsonPath("$.data.vip").isNumber())
                .andExpect(jsonPath("$.data.newLast30Days").isNumber())
                .andExpect(jsonPath("$.data.active").isNumber());
    }

    @Test
    void customerSummaryIncludesSyntheticInTotalAndVipButNotRegisteredAccountKpis() throws Exception {
        JsonNode before = customerSummary();

        CustomerEntity synthetic =
                createCustomer("summary-synthetic-" + UUID.randomUUID() + "@bigbike.test", true);
        createOrder(
                synthetic,
                "COMPLETED",
                new BigDecimal("11000000"),
                Instant.now().minus(1, ChronoUnit.DAYS));

        JsonNode after = customerSummary();
        assertThat(after.path("total").asLong()).isEqualTo(before.path("total").asLong() + 1);
        assertThat(after.path("vip").asLong()).isEqualTo(before.path("vip").asLong() + 1);
        assertThat(after.path("newLast30Days").asLong())
                .isEqualTo(before.path("newLast30Days").asLong());
        assertThat(after.path("active").asLong()).isEqualTo(before.path("active").asLong());
    }

    @Test
    void removeAvatarAuditsOnlyAnActualStateChange() throws Exception {
        CustomerEntity customer =
                createCustomer("avatar-audit-" + UUID.randomUUID() + "@bigbike.test", false);
        customer.setAvatarUrl(
                "/media/customers/" + customer.getId() + "/" + UUID.randomUUID() + "/avatar.webp");
        customerRepo.saveAndFlush(customer);
        long before = countAudits("CUSTOMER_AVATAR_REMOVED", customer.getId());

        mockMvc.perform(delete("/api/v1/admin/customers/" + customer.getId() + "/avatar")
                        .header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.avatarUrl").doesNotExist());
        assertThat(countAudits("CUSTOMER_AVATAR_REMOVED", customer.getId())).isEqualTo(before + 1);
        JsonNode afterData =
                OBJECT_MAPPER.readTree(latestAuditAfter("CUSTOMER_AVATAR_REMOVED", customer.getId()));
        assertThat(afterData.path("avatarPresent").asBoolean()).isFalse();
        verify(customerAvatarStorageService, times(1)).deleteAvatar(customer.getAvatarUrl());

        mockMvc.perform(delete("/api/v1/admin/customers/" + customer.getId() + "/avatar")
                        .header("Authorization", bearer()))
                .andExpect(status().isOk());
        assertThat(countAudits("CUSTOMER_AVATAR_REMOVED", customer.getId())).isEqualTo(before + 1);
        verify(customerAvatarStorageService, times(1)).deleteAvatar(customer.getAvatarUrl());
    }

    private CustomerEntity createCustomer(String email, boolean synthetic) {
        CustomerEntity customer = new CustomerEntity();
        customer.setEmail(email);
        customer.setPasswordHash(passwordService.hash("Customer@Test123"));
        customer.setDisplayName("Contract Customer");
        customer.setStatus("ACTIVE");
        customer.setSynthetic(synthetic);
        Instant now = Instant.now();
        customer.setCreatedAt(now);
        customer.setUpdatedAt(now);
        return customerRepo.saveAndFlush(customer);
    }

    private void createOrder(CustomerEntity customer, String status, BigDecimal total, Instant placedAt) {
        OrderEntity order = new OrderEntity();
        String marker = UUID.randomUUID().toString();
        order.setOrderNumber("BB-CUST-" + marker);
        order.setOrderKey("bb_customer_" + marker);
        order.setCustomerId(customer.getId());
        order.setCustomerEmail(customer.getEmail());
        order.setCustomerName(customer.getDisplayName());
        order.setStatus(status);
        order.setTotalAmount(total);
        order.setSubtotalAmount(total);
        order.setPlacedAt(placedAt);
        order.setCreatedAt(placedAt);
        order.setUpdatedAt(placedAt);
        orderRepo.saveAndFlush(order);
    }

    private long countStatusAudits(UUID customerId) {
        return countAudits("CUSTOMER_STATUS_UPDATED", customerId);
    }

    private long countAudits(String action, UUID customerId) {
        return auditLogRepo.findAll().stream()
                .filter(audit -> action.equals(audit.getAction()))
                .filter(audit -> customerId.equals(audit.getResourceId()))
                .count();
    }

    private String latestAuditAfter(String action, UUID customerId) {
        return auditLogRepo.findAll().stream()
                .filter(audit -> action.equals(audit.getAction()))
                .filter(audit -> customerId.equals(audit.getResourceId()))
                .max(Comparator.comparing(audit -> audit.getCreatedAt()))
                .orElseThrow()
                .getAfterData();
    }

    private String json(Map<String, ?> value) throws Exception {
        return OBJECT_MAPPER.writeValueAsString(value);
    }

    private JsonNode customerSummary() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/admin/customers/summary")
                        .header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andReturn();
        return OBJECT_MAPPER.readTree(result.getResponse().getContentAsString()).path("data");
    }

    private String bearer() {
        return "Bearer " + adminToken;
    }

    private void ensureAdminUser() {
        adminUserRepo.findByEmail(ADMIN_EMAIL).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(ADMIN_EMAIL);
            admin.setPasswordHash(passwordService.hash(ADMIN_PASSWORD));
            admin.setDisplayName("Customer Contract Admin");
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
                        .content(json(Map.of("email", ADMIN_EMAIL, "password", ADMIN_PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        return OBJECT_MAPPER.readTree(result.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();
    }
}
