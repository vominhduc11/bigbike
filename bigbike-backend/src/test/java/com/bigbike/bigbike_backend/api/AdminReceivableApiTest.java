package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.receivable.ReceivableEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.receivable.ReceivableJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import java.math.BigDecimal;
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

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class AdminReceivableApiTest {

    private static final String ADMIN_EMAIL    = "ar-admin-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS     = "Admin@AR12345678";
    private static final String SHOP_MGR_EMAIL = "ar-shopmgr-" + UUID.randomUUID() + "@bigbike.test";
    private static final String SHOP_MGR_PASS  = "ShopMgr@AR12345678";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired OrderJpaRepository orderRepo;
    @Autowired ReceivableJpaRepository receivableRepo;
    @Autowired CustomerJpaRepository customerRepo;
    @Autowired PasswordService passwordService;

    private MockMvc mockMvc;
    private String adminToken;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders
                .webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();

        // Create test admin
        if (adminUserRepo.findByEmail(ADMIN_EMAIL).isEmpty()) {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(ADMIN_EMAIL);
            admin.setPasswordHash(passwordService.hash(ADMIN_PASS));
            admin.setDisplayName("AR Test Admin");
            admin.setRole("ADMIN");
            admin.setStatus("ACTIVE");
            admin.setCreatedAt(Instant.now());
            admin.setUpdatedAt(Instant.now());
            adminUserRepo.save(admin);
        }

        // Create shop manager (does NOT have receivables.write_off)
        if (adminUserRepo.findByEmail(SHOP_MGR_EMAIL).isEmpty()) {
            AdminUserEntity mgr = new AdminUserEntity();
            mgr.setEmail(SHOP_MGR_EMAIL);
            mgr.setPasswordHash(passwordService.hash(SHOP_MGR_PASS));
            mgr.setDisplayName("AR Test ShopManager");
            mgr.setRole("SHOP_MANAGER");
            mgr.setStatus("ACTIVE");
            mgr.setCreatedAt(Instant.now());
            mgr.setUpdatedAt(Instant.now());
            adminUserRepo.save(mgr);
        }

        // Login
        MvcResult loginResult = mockMvc.perform(
                post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + ADMIN_EMAIL + "\",\"password\":\"" + ADMIN_PASS + "\"}")
        ).andExpect(status().isOk()).andReturn();
        String body = loginResult.getResponse().getContentAsString();
        int start = body.indexOf("\"accessToken\":\"") + 15;
        int end = body.indexOf("\"", start);
        adminToken = body.substring(start, end);
    }

    // ── Helper builders ───────────────────────────────────────────────────────

    private CustomerEntity createCreditCustomer() {
        CustomerEntity c = new CustomerEntity();
        c.setEmail("credit-cust-" + UUID.randomUUID() + "@test.com");
        c.setPhone("09" + (int)(Math.random() * 100000000));
        c.setDisplayName("Credit Customer");
        c.setStatus("ACTIVE");
        c.setSynthetic(false);
        c.setCreditEnabled(true);
        c.setCreditLimit(new BigDecimal("10000000"));
        c.setPaymentTermsDays(30);
        c.setCreditStatus("ACTIVE");
        c.setCreatedAt(Instant.now());
        c.setUpdatedAt(Instant.now());
        return customerRepo.save(c);
    }

    private OrderEntity createOrder(String paymentStatus, BigDecimal total, BigDecimal paid, UUID customerId) {
        OrderEntity o = new OrderEntity();
        o.setOrderNumber("TEST-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        o.setOrderKey(UUID.randomUUID().toString());
        o.setStatus("COMPLETED");
        o.setPaymentStatus(paymentStatus);
        o.setChannel("IN_STORE");
        o.setFulfillmentType("IN_STORE");
        o.setPaymentMethod("CREDIT");
        o.setCustomerId(customerId);
        o.setCustomerName("Test Customer");
        o.setCurrency("VND");
        o.setSubtotalAmount(total);
        o.setDiscountAmount(BigDecimal.ZERO);
        o.setShippingAmount(BigDecimal.ZERO);
        o.setFeeAmount(BigDecimal.ZERO);
        o.setTaxAmount(BigDecimal.ZERO);
        o.setTotalAmount(total);
        o.setPaidAmount(paid);
        o.setRefundAmount(BigDecimal.ZERO);
        o.setPlacedAt(Instant.now());
        o.setCompletedAt(Instant.now());
        o.setCreatedAt(Instant.now());
        o.setUpdatedAt(Instant.now());
        return orderRepo.save(o);
    }

    private ReceivableEntity createReceivable(OrderEntity order, CustomerEntity customer, BigDecimal outstanding) {
        ReceivableEntity ar = new ReceivableEntity();
        ar.setOrderId(order.getId());
        ar.setCustomerId(customer.getId());
        ar.setCustomerName(customer.getDisplayName());
        ar.setOriginalAmount(order.getTotalAmount());
        ar.setPaidAmount(order.getPaidAmount());
        ar.setOutstandingAmount(outstanding);
        ar.setWrittenOffAmount(BigDecimal.ZERO);
        ar.setStatus("OPEN");
        ar.setCreatedFrom("POS");
        ar.setDueDate(LocalDate.now().plusDays(30));
        ar.setPaymentTermsDays(30);
        ar.setCreatedAt(Instant.now());
        ar.setUpdatedAt(Instant.now());
        return receivableRepo.save(ar);
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    @Test
    void listReceivables_returnsOk() throws Exception {
        mockMvc.perform(get("/api/v1/admin/receivables")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void getSummary_returnsOk() throws Exception {
        mockMvc.perform(get("/api/v1/admin/receivables/summary")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalOutstanding").exists());
    }

    @Test
    void getAging_returnsOk() throws Exception {
        mockMvc.perform(get("/api/v1/admin/receivables/aging")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.notDue").exists());
    }

    @Test
    void recordPayment_partialAmount_updatesStatusAndOrder() throws Exception {
        CustomerEntity customer = createCreditCustomer();
        OrderEntity order = createOrder("UNPAID", new BigDecimal("1000000"), BigDecimal.ZERO, customer.getId());
        ReceivableEntity ar = createReceivable(order, customer, new BigDecimal("1000000"));

        mockMvc.perform(post("/api/v1/admin/receivables/" + ar.getId() + "/payments")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":300000,\"paymentMethod\":\"CASH\",\"note\":\"Trả một phần\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PARTIALLY_PAID"))
                .andExpect(jsonPath("$.data.outstandingAmount").value(700000));

        // Order paidAmount must be updated; paymentStatus stays UNPAID until fully settled
        OrderEntity refreshedOrder = orderRepo.findById(order.getId()).orElseThrow();
        assertThat(refreshedOrder.getPaidAmount()).isEqualByComparingTo(new BigDecimal("300000"));
        assertThat(refreshedOrder.getPaymentStatus()).isEqualTo("UNPAID");
    }

    @Test
    void recordPayment_fullAmount_closeReceivableAndPaidOrder() throws Exception {
        CustomerEntity customer = createCreditCustomer();
        OrderEntity order = createOrder("UNPAID", new BigDecimal("500000"), BigDecimal.ZERO, customer.getId());
        ReceivableEntity ar = createReceivable(order, customer, new BigDecimal("500000"));

        mockMvc.perform(post("/api/v1/admin/receivables/" + ar.getId() + "/payments")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":500000,\"paymentMethod\":\"BANK_TRANSFER\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CLOSED"))
                .andExpect(jsonPath("$.data.outstandingAmount").value(0));

        OrderEntity refreshedOrder = orderRepo.findById(order.getId()).orElseThrow();
        assertThat(refreshedOrder.getPaymentStatus()).isEqualTo("PAID");
    }

    @Test
    void recordPayment_amountExceedsOutstanding_returnsBadRequest() throws Exception {
        CustomerEntity customer = createCreditCustomer();
        OrderEntity order = createOrder("UNPAID", new BigDecimal("200000"), BigDecimal.ZERO, customer.getId());
        ReceivableEntity ar = createReceivable(order, customer, new BigDecimal("200000"));

        mockMvc.perform(post("/api/v1/admin/receivables/" + ar.getId() + "/payments")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":999999,\"paymentMethod\":\"CASH\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void writeOff_requiresReason() throws Exception {
        CustomerEntity customer = createCreditCustomer();
        OrderEntity order = createOrder("UNPAID", new BigDecimal("300000"), BigDecimal.ZERO, customer.getId());
        ReceivableEntity ar = createReceivable(order, customer, new BigDecimal("300000"));

        // No reason — should fail validation
        mockMvc.perform(post("/api/v1/admin/receivables/" + ar.getId() + "/write-off")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"\"}"))
                .andExpect(status().isBadRequest());

        // With reason — should succeed
        mockMvc.perform(post("/api/v1/admin/receivables/" + ar.getId() + "/write-off")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Khách mất tích, không thể thu hồi\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("WRITTEN_OFF"));
    }

    @Test
    void customerCredit_updateAndRead() throws Exception {
        CustomerEntity customer = createCreditCustomer();

        mockMvc.perform(patch("/api/v1/admin/customers/" + customer.getId() + "/credit")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"creditEnabled\":true,\"creditLimit\":5000000,\"paymentTermsDays\":15,\"creditStatus\":\"ACTIVE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.creditLimit").value(5000000));

        mockMvc.perform(get("/api/v1/admin/customers/" + customer.getId() + "/credit")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentTermsDays").value(15));
    }

    // ── currentOutstanding / availableCredit contract tests ───────────────────

    @Test
    void customerCredit_noReceivables_currentOutstandingIsZero() throws Exception {
        CustomerEntity customer = createCreditCustomer(); // credit_limit = 10_000_000

        mockMvc.perform(get("/api/v1/admin/customers/" + customer.getId() + "/credit")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.currentOutstanding").value(0))
                .andExpect(jsonPath("$.data.availableCredit").value(10000000));
    }

    @Test
    void customerCredit_withOpenReceivable_currentOutstandingIsCorrect() throws Exception {
        CustomerEntity customer = createCreditCustomer(); // credit_limit = 10_000_000
        OrderEntity order = createOrder("UNPAID", new BigDecimal("2000000"), BigDecimal.ZERO, customer.getId());
        createReceivable(order, customer, new BigDecimal("2000000")); // OPEN, outstanding = 2_000_000

        mockMvc.perform(get("/api/v1/admin/customers/" + customer.getId() + "/credit")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.currentOutstanding").value(2000000))
                .andExpect(jsonPath("$.data.availableCredit").value(8000000));
    }

    @Test
    void customerCredit_withPartiallyPaidReceivable_currentOutstandingIsCorrect() throws Exception {
        CustomerEntity customer = createCreditCustomer(); // credit_limit = 10_000_000
        OrderEntity order = createOrder("UNPAID", new BigDecimal("3000000"), new BigDecimal("1000000"), customer.getId());

        ReceivableEntity ar = new ReceivableEntity();
        ar.setOrderId(order.getId());
        ar.setCustomerId(customer.getId());
        ar.setCustomerName(customer.getDisplayName());
        ar.setOriginalAmount(new BigDecimal("3000000"));
        ar.setPaidAmount(new BigDecimal("1000000"));
        ar.setOutstandingAmount(new BigDecimal("2000000")); // 3M - 1M paid
        ar.setWrittenOffAmount(BigDecimal.ZERO);
        ar.setStatus("PARTIALLY_PAID");
        ar.setCreatedFrom("POS");
        ar.setDueDate(LocalDate.now().plusDays(30));
        ar.setPaymentTermsDays(30);
        ar.setCreatedAt(Instant.now());
        ar.setUpdatedAt(Instant.now());
        receivableRepo.save(ar);

        mockMvc.perform(get("/api/v1/admin/customers/" + customer.getId() + "/credit")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.currentOutstanding").value(2000000))
                .andExpect(jsonPath("$.data.availableCredit").value(8000000));
    }

    @Test
    void customerCredit_closedAndWrittenOffReceivables_notCountedInOutstanding() throws Exception {
        CustomerEntity customer = createCreditCustomer(); // credit_limit = 10_000_000

        // CLOSED receivable — should NOT count
        OrderEntity closedOrder = createOrder("PAID", new BigDecimal("1000000"), new BigDecimal("1000000"), customer.getId());
        ReceivableEntity closedAr = createReceivable(closedOrder, customer, BigDecimal.ZERO);
        closedAr.setStatus("CLOSED");
        closedAr.setPaidAmount(new BigDecimal("1000000"));
        closedAr.setOutstandingAmount(BigDecimal.ZERO);
        receivableRepo.save(closedAr);

        // WRITTEN_OFF receivable — should NOT count
        OrderEntity writtenOrder = createOrder("UNPAID", new BigDecimal("500000"), BigDecimal.ZERO, customer.getId());
        ReceivableEntity writtenAr = createReceivable(writtenOrder, customer, new BigDecimal("500000"));
        writtenAr.setStatus("WRITTEN_OFF");
        writtenAr.setWrittenOffAmount(new BigDecimal("500000"));
        writtenAr.setOutstandingAmount(BigDecimal.ZERO);
        receivableRepo.save(writtenAr);

        mockMvc.perform(get("/api/v1/admin/customers/" + customer.getId() + "/credit")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.currentOutstanding").value(0))
                .andExpect(jsonPath("$.data.availableCredit").value(10000000));
    }

    @Test
    void customerCredit_nullCreditLimit_availableCreditIsNull() throws Exception {
        CustomerEntity customer = new CustomerEntity();
        customer.setEmail("no-limit-" + UUID.randomUUID() + "@test.com");
        customer.setPhone("0912345001");
        customer.setDisplayName("No Limit Customer");
        customer.setStatus("ACTIVE");
        customer.setSynthetic(false);
        customer.setCreditEnabled(true);
        customer.setCreditLimit(null); // no limit
        customer.setCreditStatus("ACTIVE");
        customer.setCreatedAt(Instant.now());
        customer.setUpdatedAt(Instant.now());
        customer = customerRepo.save(customer);

        mockMvc.perform(get("/api/v1/admin/customers/" + customer.getId() + "/credit")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.currentOutstanding").value(0))
                .andExpect(jsonPath("$.data.availableCredit").doesNotExist());
    }

    // ── POSREC-008: write-off permission test ─────────────────────────────────

    @Test
    void writeOff_shopManager_withoutWriteOffPermission_returns403() throws Exception {
        String shopMgrToken = loginShopManager();

        CustomerEntity customer = createCreditCustomer();
        OrderEntity order = createOrder("UNPAID", new BigDecimal("500000"), BigDecimal.ZERO, customer.getId());
        ReceivableEntity ar = createReceivable(order, customer, new BigDecimal("500000"));

        // SHOP_MANAGER does not have receivables.write_off — should get 403
        mockMvc.perform(post("/api/v1/admin/receivables/" + ar.getId() + "/write-off")
                        .header("Authorization", "Bearer " + shopMgrToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Khách không trả nổi\"}"))
                .andExpect(status().isForbidden());
    }

    // ── POSREC-006: write-off updates order.paymentStatus ────────────────────

    @Test
    void writeOff_updatesOrderPaymentStatusToWrittenOff() throws Exception {
        CustomerEntity customer = createCreditCustomer();
        OrderEntity order = createOrder("UNPAID", new BigDecimal("400000"), BigDecimal.ZERO, customer.getId());
        ReceivableEntity ar = createReceivable(order, customer, new BigDecimal("400000"));

        mockMvc.perform(post("/api/v1/admin/receivables/" + ar.getId() + "/write-off")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Không thu được\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("WRITTEN_OFF"));

        // Verify order paymentStatus updated
        OrderEntity refreshedOrder = orderRepo.findById(order.getId()).orElseThrow();
        assertThat(refreshedOrder.getPaymentStatus()).isEqualTo("WRITTEN_OFF");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String loginShopManager() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + SHOP_MGR_EMAIL + "\",\"password\":\"" + SHOP_MGR_PASS + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String body = result.getResponse().getContentAsString();
        int start = body.indexOf("\"accessToken\":\"") + 15;
        int end = body.indexOf("\"", start);
        return body.substring(start, end);
    }
}
