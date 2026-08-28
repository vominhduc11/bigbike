package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAddressEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class AdminQuickSearchApiTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private OrderJpaRepository orderRepository;

    @Autowired
    private OrderAddressJpaRepository orderAddressRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        // The existing admin API tests exercise the controller's guarded dev-header path
        // without installing the servlet security filters; RBAC filter coverage lives in
        // RbacSecurityTest.
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    void searchesStoredCustomerAndShippingRecipientNamesWithoutAccent() throws Exception {
        String suffix = UUID.randomUUID().toString();
        OrderEntity order = createOrder(
                "Nguyễn Quick Customer " + suffix,
                "quick-search-" + suffix + "@example.test");
        createShippingAddress(order, "Trần Quick Recipient " + suffix);

        for (String query : List.of(
                "nguyen quick customer " + suffix,
                "NGUYỄN QUICK CUSTOMER " + suffix)) {
            mockMvc.perform(get("/api/v1/admin/quick-search")
                            .param("q", query)
                            .header("X-Admin-Permissions", "orders.read"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.groups.orders.state").value("READY"))
                    .andExpect(jsonPath("$.data.groups.orders.total").value(1))
                    .andExpect(jsonPath("$.data.groups.orders.items[0].id")
                            .value(order.getId().toString()))
                    .andExpect(jsonPath("$.data.groups.orders.items[0].customerName")
                            .value("Nguyễn Quick Customer " + suffix))
                    .andExpect(jsonPath("$.data.groups.products").doesNotExist());
        }

        mockMvc.perform(get("/api/v1/admin/quick-search")
                        .param("q", "tran quick recipient " + suffix)
                        .header("X-Admin-Permissions", "orders.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.groups.orders.total").value(1))
                .andExpect(jsonPath("$.data.groups.orders.items[0].shippingRecipientName")
                        .value("Trần Quick Recipient " + suffix));
    }

    @Test
    void treatsPercentAsLiteralInsteadOfReturningEveryOrder() throws Exception {
        mockMvc.perform(get("/api/v1/admin/quick-search")
                        .param("q", "%")
                        .header("X-Admin-Permissions", "orders.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.groups.orders.state").value("READY"))
                .andExpect(jsonPath("$.data.groups.orders.total").value(0))
                .andExpect(jsonPath("$.data.groups.orders.items").isEmpty());
    }

    @Test
    void refusesCallWhenCallerHasNoSearchReadPermission() throws Exception {
        mockMvc.perform(get("/api/v1/admin/quick-search")
                        .param("q", "order")
                        .header("X-Admin-Permissions", "reports.read"))
                .andExpect(status().isForbidden());
    }

    private OrderEntity createOrder(String customerName, String email) {
        Instant now = Instant.parse("2026-08-28T08:00:00Z");
        OrderEntity order = new OrderEntity();
        order.setOrderNumber("QUICK-SEARCH-" + UUID.randomUUID());
        order.setOrderKey("quick-search-key-" + UUID.randomUUID());
        order.setCustomerName(customerName);
        order.setCustomerEmail(email);
        order.setCustomerPhone("0900000000");
        order.setStatus("PENDING");
        order.setCurrency("VND");
        order.setSubtotalAmount(BigDecimal.valueOf(100_000));
        order.setDiscountAmount(BigDecimal.ZERO);
        order.setShippingAmount(BigDecimal.ZERO);
        order.setFeeAmount(BigDecimal.ZERO);
        order.setTaxAmount(BigDecimal.ZERO);
        order.setTotalAmount(BigDecimal.valueOf(100_000));
        order.setPaidAmount(BigDecimal.ZERO);
        order.setChannel("WEB");
        order.setFulfillmentType("DELIVERY");
        order.setPaymentMethod("COD");
        order.setSource("TEST");
        order.setPlacedAt(now);
        order.setCreatedAt(now);
        order.setUpdatedAt(now);
        return orderRepository.saveAndFlush(order);
    }

    private void createShippingAddress(OrderEntity order, String fullName) {
        Instant now = Instant.parse("2026-08-28T08:00:00Z");
        OrderAddressEntity address = new OrderAddressEntity();
        address.setOrder(order);
        address.setType("SHIPPING");
        address.setFullName(fullName);
        address.setPhone("0900000001");
        address.setCountry("VN");
        address.setCreatedAt(now);
        address.setUpdatedAt(now);
        orderAddressRepository.saveAndFlush(address);
    }
}
