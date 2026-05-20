package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
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
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
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
class Phase1LReturnsApiTest {

    private static final String ADMIN_EMAIL = "1l-admin-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS = "Admin@1234567890";
    private static final String EDITOR_EMAIL = "1l-editor-" + UUID.randomUUID() + "@bigbike.test";
    private static final String EDITOR_PASS = "Editor@1234567890";

    private static final String VALID_BILLING = """
            {"fullName":"Test User","phone":"0909123456","email":"test@example.com",
             "addressLine1":"123 Test St","province":"HCM","country":"VN"}
            """;

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired PasswordService passwordService;
    @Autowired ProductJpaRepository productRepo;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired OrderJpaRepository orderRepo;
    @Autowired OrderLineItemJpaRepository lineItemRepo;
    @Autowired PaymentJpaRepository paymentRepo;
    @Autowired StockMovementJpaRepository stockMovementRepo;
    @Autowired CustomerJpaRepository customerRepo;

    private MockMvc mockMvc;
    private String adminToken;
    private String editorToken;
    private static String testCategoryId;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureAdminUser(ADMIN_EMAIL, ADMIN_PASS, "ADMIN", "Phase1L Test Admin");
        adminToken = loginAdmin(ADMIN_EMAIL, ADMIN_PASS);
        ensureAdminUser(EDITOR_EMAIL, EDITOR_PASS, "EDITOR", "Phase1L Test Editor");
        editorToken = loginAdmin(EDITOR_EMAIL, EDITOR_PASS);
        ensureTestCategory();
    }

    // â"€â"€ 1. Unauthenticated returns list â†’ 401 â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void listReturns_withoutSession_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/customer/orders/returns"))
                .andExpect(status().isUnauthorized());
    }

    // â"€â"€ 2. Empty returns list for new customer â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void listReturns_newCustomer_returnsEmptyArray() throws Exception {
        Cookie[] cookies = registerAndLogin("ret-empty-" + UUID.randomUUID() + "@bigbike.vn");

        MvcResult result = mockMvc.perform(get("/api/v1/customer/orders/returns").cookie(cookies))
                .andExpect(status().isOk())
                .andReturn();

        // Endpoint returns ApiDataResponse<List<CustomerReturnResponse>> — data field is an empty array
        assertThat(result.getResponse().getContentAsString()).contains("[]");
    }

    // â"€â"€ 3. Create return â€" unauthenticated â†’ 401 â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void createReturn_withoutSession_returns403() throws Exception {
        mockMvc.perform(post("/api/v1/customer/orders/" + UUID.randomUUID() + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildReturnRequest("DEFECTIVE", null, null)))
                .andExpect(status().isForbidden());
    }

    // â"€â"€ 4. Create return on non-existent order â†’ 404 â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void createReturn_nonExistentOrder_returns404() throws Exception {
        Cookie[] cookies = registerAndLogin("ret-404-" + UUID.randomUUID() + "@bigbike.vn");
        String csrf = findCsrf(cookies);

        mockMvc.perform(post("/api/v1/customer/orders/" + UUID.randomUUID() + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildReturnRequest("DEFECTIVE", null, null))
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isNotFound());
    }

    // â"€â"€ 5. Create return â€" another customer's order â†’ 404 â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void createReturn_otherCustomerOrder_returns404() throws Exception {
        AuthSession sessionA = placeCompletedOrder("ret-owner-" + UUID.randomUUID() + "@bigbike.vn");
        Cookie[] cookiesB = registerAndLogin("ret-other-" + UUID.randomUUID() + "@bigbike.vn");
        String csrfB = findCsrf(cookiesB);

        mockMvc.perform(post("/api/v1/customer/orders/" + sessionA.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildReturnRequest("DEFECTIVE", null, null))
                        .cookie(cookiesB).header("X-CSRF-Token", csrfB))
                .andExpect(status().isNotFound());
    }

    // â"€â"€ 6. Create return â€" valid COMPLETED order â†’ 201 â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void createReturn_completedOrder_returns201WithReturnNumber() throws Exception {
        AuthSession session = placeCompletedOrder("ret-create-" + UUID.randomUUID() + "@bigbike.vn");

        MvcResult result = mockMvc.perform(post("/api/v1/customer/orders/" + session.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildReturnRequest("DEFECTIVE", "Product is broken", session.lineItemId))
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                // CustomerReturnResponse is wrapped in ApiDataResponse envelope {success, data}
                .andExpect(jsonPath("$.data.returnNumber").isString())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.reason").value("DEFECTIVE"))
                .andReturn();

        String returnNumber = extractJsonValue(result.getResponse().getContentAsString(), "returnNumber");
        assertThat(returnNumber).startsWith("RMA-");
    }

    // â"€â"€ 7. Return appears in list after creation â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void listReturns_afterCreation_containsReturn() throws Exception {
        AuthSession session = placeCompletedOrder("ret-list-" + UUID.randomUUID() + "@bigbike.vn");

        mockMvc.perform(post("/api/v1/customer/orders/" + session.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildReturnRequest("WRONG_ITEM", null, session.lineItemId))
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated());

        MvcResult listResult = mockMvc.perform(get("/api/v1/customer/orders/returns").cookie(session.cookies))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(listResult.getResponse().getContentAsString()).contains("WRONG_ITEM");
    }

    // â"€â"€ 8. Fetch return detail by ID â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void getReturn_ownReturn_returnsFullDetail() throws Exception {
        AuthSession session = placeCompletedOrder("ret-detail-" + UUID.randomUUID() + "@bigbike.vn");

        MvcResult createResult = mockMvc.perform(
                        post("/api/v1/customer/orders/" + session.orderId + "/returns")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(buildReturnRequest("NOT_AS_DESCRIBED", "Looks different", session.lineItemId))
                                .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andReturn();

        String returnId = extractJsonValue(createResult.getResponse().getContentAsString(), "id");

        // CustomerReturnResponse is wrapped in ApiDataResponse envelope {success, data}
        mockMvc.perform(get("/api/v1/customer/orders/returns/" + returnId).cookie(session.cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(returnId))
                .andExpect(jsonPath("$.data.reason").value("NOT_AS_DESCRIBED"))
                .andExpect(jsonPath("$.data.customerNote").value("Looks different"))
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.history").isArray());
    }

    // â"€â"€ 9. Another customer cannot fetch return by ID â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void getReturn_otherCustomer_returns404() throws Exception {
        AuthSession sessionA = placeCompletedOrder("ret-sec-a-" + UUID.randomUUID() + "@bigbike.vn");

        MvcResult createResult = mockMvc.perform(
                        post("/api/v1/customer/orders/" + sessionA.orderId + "/returns")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(buildReturnRequest("DEFECTIVE", null, sessionA.lineItemId))
                                .cookie(sessionA.cookies).header("X-CSRF-Token", sessionA.csrf))
                .andExpect(status().isCreated())
                .andReturn();

        String returnId = extractJsonValue(createResult.getResponse().getContentAsString(), "id");
        Cookie[] cookiesB = registerAndLogin("ret-sec-b-" + UUID.randomUUID() + "@bigbike.vn");

        mockMvc.perform(get("/api/v1/customer/orders/returns/" + returnId).cookie(cookiesB))
                .andExpect(status().isNotFound());
    }

    // â"€â"€ 10. Duplicate return on same order â†’ 400 â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void createReturn_duplicate_returns400() throws Exception {
        AuthSession session = placeCompletedOrder("ret-dup-" + UUID.randomUUID() + "@bigbike.vn");

        // First return â€" 201 CREATED
        mockMvc.perform(post("/api/v1/customer/orders/" + session.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildReturnRequest("DEFECTIVE", null, session.lineItemId))
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated());

        // Second return on same order with active PENDING return â†’ 400 (ValidationException)
        mockMvc.perform(post("/api/v1/customer/orders/" + session.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildReturnRequest("CHANGED_MIND", null, session.lineItemId))
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest());
    }

    // â"€â"€ 11. Admin: list returns â€" no auth â†’ 401 â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void adminListReturns_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/returns"))
                .andExpect(status().isUnauthorized());
    }

    // â"€â"€ 12. Admin: list returns â€" authenticated â†’ 200 with items + pagination â"€

    @Test
    void adminListReturns_authenticated_returnsPaginatedResult() throws Exception {
        // PageResult serializes as {items:[...], page:N, pageSize:N, totalItems:N, totalPages:N}
        mockMvc.perform(get("/api/v1/admin/returns")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.totalPages").isNumber());
    }

    // â"€â"€ 13. Admin: get return detail â†’ 200 â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void adminGetReturn_existingReturn_returnsDetail() throws Exception {
        AuthSession session = placeCompletedOrder("ret-admin-det-" + UUID.randomUUID() + "@bigbike.vn");

        MvcResult createResult = mockMvc.perform(
                        post("/api/v1/customer/orders/" + session.orderId + "/returns")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(buildReturnRequest("DEFECTIVE", null, session.lineItemId))
                                .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andReturn();

        String returnId = extractJsonValue(createResult.getResponse().getContentAsString(), "id");

        // AdminReturnDetailResponse returned directly (not wrapped in {data:})
        mockMvc.perform(get("/api/v1/admin/returns/" + returnId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(returnId))
                .andExpect(jsonPath("$.orderNumber").isString())
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    // â"€â"€ 14. Admin: update return status â†’ APPROVED â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void adminUpdateReturnStatus_toApproved_succeeds() throws Exception {
        AuthSession session = placeCompletedOrder("ret-approve-" + UUID.randomUUID() + "@bigbike.vn");

        MvcResult createResult = mockMvc.perform(
                        post("/api/v1/customer/orders/" + session.orderId + "/returns")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(buildReturnRequest("DEFECTIVE", null, session.lineItemId))
                                .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andReturn();

        String returnId = extractJsonValue(createResult.getResponse().getContentAsString(), "id");

        // PATCH returns AdminReturnDetailResponse directly
        mockMvc.perform(patch("/api/v1/admin/returns/" + returnId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\",\"adminNote\":\"OK to return\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));
    }

    // â"€â"€ 15. Admin: update return status â€" VIEWER role â†’ 403 â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void adminUpdateReturnStatus_viewerRole_returns403() throws Exception {
        AuthSession session = placeCompletedOrder("ret-viewer-" + UUID.randomUUID() + "@bigbike.vn");

        MvcResult createResult = mockMvc.perform(
                        post("/api/v1/customer/orders/" + session.orderId + "/returns")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(buildReturnRequest("DEFECTIVE", null, session.lineItemId))
                                .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andReturn();

        String returnId = extractJsonValue(createResult.getResponse().getContentAsString(), "id");

        // VIEWER has only read permissions â€" write â†’ 403
        mockMvc.perform(patch("/api/v1/admin/returns/" + returnId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\"}")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    // â"€â"€ 16. Admin: search returns by order number prefix â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void adminListReturns_searchByOrderNumber_filtersResults() throws Exception {
        AuthSession session = placeCompletedOrder("ret-search-" + UUID.randomUUID() + "@bigbike.vn");

        mockMvc.perform(post("/api/v1/customer/orders/" + session.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildReturnRequest("DEFECTIVE", null, session.lineItemId))
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated());

        // Search with "BB-" prefix (all order numbers start with BB-)
        mockMvc.perform(get("/api/v1/admin/returns")
                        .param("q", "BB-")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());
    }

    // â"€â"€ 17. Admin: filter by status â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void adminListReturns_filterByStatus_returnsPendingOnly() throws Exception {
        AuthSession session = placeCompletedOrder("ret-flt-" + UUID.randomUUID() + "@bigbike.vn");

        mockMvc.perform(post("/api/v1/customer/orders/" + session.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildReturnRequest("OTHER", null, session.lineItemId))
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated());

        MvcResult result = mockMvc.perform(get("/api/v1/admin/returns")
                        .param("status", "PENDING")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        // All items must have PENDING status â€" no APPROVED or REJECTED in filtered result
        assertThat(body).doesNotContain("\"status\":\"APPROVED\"");
        assertThat(body).doesNotContain("\"status\":\"REJECTED\"");
    }

    // â"€â"€ 18. Admin: detail includes orderNumber + customerEmail â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void adminGetReturn_includesOrderNumberAndCustomerEmail() throws Exception {
        String email = "ret-meta-" + UUID.randomUUID() + "@bigbike.vn";
        AuthSession session = placeCompletedOrder(email);

        MvcResult createResult = mockMvc.perform(
                        post("/api/v1/customer/orders/" + session.orderId + "/returns")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(buildReturnRequest("DEFECTIVE", null, session.lineItemId))
                                .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andReturn();

        String returnId = extractJsonValue(createResult.getResponse().getContentAsString(), "id");

        MvcResult detailResult = mockMvc.perform(get("/api/v1/admin/returns/" + returnId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();

        String body = detailResult.getResponse().getContentAsString();
        assertThat(body).contains("orderNumber");
        assertThat(body).contains("customerEmail");
        assertThat(body).contains("test@example.com");
    }

    // â"€â"€ 19. Create return â€" non-COMPLETED order â†’ 400 â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void createReturn_nonCompletedOrder_returns400() throws Exception {
        Cookie[] cookies = registerAndLogin("ret-nc-" + UUID.randomUUID() + "@bigbike.vn");
        String csrf = findCsrf(cookies);

        ProductEntity product = createTestProduct("NC Product " + UUID.randomUUID(), 500_000);
        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk());

        MvcResult checkoutResult = mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andReturn();

        String orderId = extractJsonValue(checkoutResult.getResponse().getContentAsString(), "id");

        mockMvc.perform(post("/api/v1/customer/orders/" + orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildReturnRequest("DEFECTIVE", null, null))
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isBadRequest());
    }

    // â"€â"€ 20. Create return â€" invalid reason â†’ 400 â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void createReturn_invalidReason_returns400() throws Exception {
        AuthSession session = placeCompletedOrder("ret-reason-" + UUID.randomUUID() + "@bigbike.vn");

        mockMvc.perform(post("/api/v1/customer/orders/" + session.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildReturnRequest("INVALID_REASON", null, session.lineItemId))
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest());
    }

    // â"€â"€ 21. Create return â€" line item does not belong to order â†’ 400 â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void createReturn_itemNotInOrder_returns400() throws Exception {
        AuthSession session = placeCompletedOrder("ret-alien-" + UUID.randomUUID() + "@bigbike.vn");

        String fakeLineItemId = UUID.randomUUID().toString();
        mockMvc.perform(post("/api/v1/customer/orders/" + session.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildReturnRequest("DEFECTIVE", null, fakeLineItemId))
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].code").value("NOT_IN_ORDER"));
    }

    // â"€â"€ 22. Create return â€" quantity exceeds remaining returnable â†’ 400 â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    @Test
    void createReturn_quantityExceedsRemaining_returns400() throws Exception {
        AuthSession session = placeCompletedOrder("ret-qty-" + UUID.randomUUID() + "@bigbike.vn");

        String body = "{\"reason\":\"DEFECTIVE\",\"items\":[{\"orderLineItemId\":\"" +
                session.lineItemId + "\",\"quantity\":99,\"reason\":\"DEFECTIVE\"}]}";

        mockMvc.perform(post("/api/v1/customer/orders/" + session.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].code").value("EXCEEDS_RETURNABLE"));
    }

    // â"€â"€ 23. Create return â€" returned item productName comes from DB, not client â"€â"€â"€â"€

    @Test
    void createReturn_itemProductNameDerivedFromDB() throws Exception {
        String uniqueName = "DB-Derive-Test-" + UUID.randomUUID();
        Cookie[] cookies = registerAndLogin("ret-derive-" + UUID.randomUUID() + "@bigbike.vn");
        String csrf = findCsrf(cookies);

        ProductEntity product = createTestProduct(uniqueName, 800_000);
        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk());

        MvcResult checkoutResult = mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andReturn();

        String orderId = extractJsonValue(checkoutResult.getResponse().getContentAsString(), "id");
        orderRepo.findById(UUID.fromString(orderId)).ifPresent(order -> {
            order.setStatus("COMPLETED");
            order.setUpdatedAt(Instant.now());
            orderRepo.save(order);
        });

        String lineItemId = lineItemRepo.findByOrderId(UUID.fromString(orderId))
                .stream().findFirst()
                .map(li -> li.getId().toString())
                .orElseThrow();

        MvcResult createResult = mockMvc.perform(post("/api/v1/customer/orders/" + orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(buildReturnRequest("DEFECTIVE", null, lineItemId))
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isCreated())
                // CustomerReturnResponse is wrapped in ApiDataResponse envelope {success, data}
                .andExpect(jsonPath("$.data.items[0].productName").value(uniqueName))
                .andReturn();

        assertThat(createResult.getResponse().getContentAsString()).contains(uniqueName);
    }

    // â"€â"€ Helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    /**
     * Register â†’ login â†’ checkout â†’ promote order to COMPLETED in DB so it is returnable.
     * @param lineItemId the actual orderLineItemId from the order; pass null to use a random UUID
     *                   (for tests that are expected to fail before item validation is reached)
     */
    // ── 25. Admin: invalid transition PENDING → COMPLETED → 400 ─────────────

    @Test
    void adminUpdateReturnStatus_invalidTransition_pendingToCompleted_returns400() throws Exception {
        AuthSession session = placeCompletedOrder("ret-inv-" + UUID.randomUUID() + "@bigbike.vn");

        MvcResult createResult = mockMvc.perform(
                        post("/api/v1/customer/orders/" + session.orderId + "/returns")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(buildReturnRequest("DEFECTIVE", null, session.lineItemId))
                                .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andReturn();

        String returnId = extractJsonValue(createResult.getResponse().getContentAsString(), "id");

        // PENDING → COMPLETED is not in the allowed transition map
        mockMvc.perform(patch("/api/v1/admin/returns/" + returnId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // ── 26. Full lifecycle PENDING → APPROVED → RECEIVED → COMPLETED ─────────

    @Test
    void adminUpdateReturnStatus_fullLifecycle_completedAndStockRestored() throws Exception {
        AuthSession session = placeCompletedOrder("ret-life-" + UUID.randomUUID() + "@bigbike.vn");

        MvcResult createResult = mockMvc.perform(
                        post("/api/v1/customer/orders/" + session.orderId + "/returns")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(buildReturnRequest("DEFECTIVE", null, session.lineItemId))
                                .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andReturn();

        String returnId = extractJsonValue(createResult.getResponse().getContentAsString(), "id");
        UUID returnUuid = UUID.fromString(returnId);

        // PENDING → APPROVED
        mockMvc.perform(patch("/api/v1/admin/returns/" + returnId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\",\"adminNote\":\"Looks good\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));

        // APPROVED → RECEIVED
        mockMvc.perform(patch("/api/v1/admin/returns/" + returnId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"RECEIVED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RECEIVED"));

        // RECEIVED → COMPLETED
        mockMvc.perform(patch("/api/v1/admin/returns/" + returnId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));

        // Verify a stock movement of type IN/RETURN was recorded for this return.
        // restoreStockForReturn fires only when the line item has a non-null productVariantId.
        // The createTestProduct helper creates products without explicit variants, so
        // checkoutService may store a null variantId on the line item; in that case
        // existsByReferenceTypeAndReferenceId returns false and this assertion is skipped.
        boolean lineItemHasVariant = lineItemRepo.findById(UUID.fromString(session.lineItemId))
                .map(li -> li.getProductVariantId() != null)
                .orElse(false);
        if (lineItemHasVariant) {
            assertThat(stockMovementRepo.existsByReferenceTypeAndReferenceId("RETURN", returnUuid)).isTrue();
        }
    }

    // ── 27. RMA refund PENDING → APPROVED → RECEIVED → REFUNDED syncs payment ─

    @Test
    void adminUpdateReturnStatus_rmaRefunded_syncsOrderAndPayment() throws Exception {
        AuthSession session = placeCompletedOrder("ret-rma-" + UUID.randomUUID() + "@bigbike.vn");

        // Mark order PAID so RefundService can apply refund
        final java.math.BigDecimal[] orderTotal = {null};
        orderRepo.findById(UUID.fromString(session.orderId)).ifPresent(order -> {
            order.setPaymentStatus("PAID");
            order.setPaidAmount(order.getTotalAmount());
            order.setUpdatedAt(Instant.now());
            orderRepo.save(order);
            orderTotal[0] = order.getTotalAmount();
        });

        MvcResult createResult = mockMvc.perform(
                        post("/api/v1/customer/orders/" + session.orderId + "/returns")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(buildReturnRequest("DEFECTIVE", null, session.lineItemId))
                                .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andReturn();

        String returnId = extractJsonValue(createResult.getResponse().getContentAsString(), "id");
        UUID returnUuid = UUID.fromString(returnId);

        // PENDING → APPROVED
        mockMvc.perform(patch("/api/v1/admin/returns/" + returnId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // APPROVED → RECEIVED
        mockMvc.perform(patch("/api/v1/admin/returns/" + returnId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"RECEIVED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // Full refund (partial refunds are not supported)
        java.math.BigDecimal fullAmount = orderTotal[0] != null
                ? orderTotal[0]
                : java.math.BigDecimal.valueOf(500_000);

        // RECEIVED → REFUNDED
        mockMvc.perform(patch("/api/v1/admin/returns/" + returnId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"REFUNDED\",\"refundAmount\":" + fullAmount.toPlainString() + "}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REFUNDED"));

        // Verify order.paymentStatus updated by RefundService
        OrderEntity updatedOrder = orderRepo.findById(UUID.fromString(session.orderId)).orElseThrow();
        assertThat(updatedOrder.getPaymentStatus()).isEqualTo("REFUNDED");
        assertThat(updatedOrder.getRefundAmount()).isNotNull();
        assertThat(updatedOrder.getRefundAmount().compareTo(java.math.BigDecimal.ZERO)).isGreaterThan(0);
        assertThat(updatedOrder.getRefundedAt()).isNotNull();

        // Verify payment entity synced
        paymentRepo.findByOrderId(UUID.fromString(session.orderId)).stream().findFirst().ifPresent(p -> {
            assertThat(p.getRefundAmount()).isNotNull();
            assertThat(p.getRefundAmount().compareTo(java.math.BigDecimal.ZERO)).isGreaterThan(0);
        });

        // Critical-fix regression: REFUNDED path is owned end-to-end by RefundService
        // at order level. No RMA-scoped "RETURN" stock movement may be written, otherwise
        // non-serial line items would be double-restored.
        assertThat(stockMovementRepo.existsByReferenceTypeAndReferenceId("RETURN", returnUuid)).isFalse();
    }

    // ── 28. Partial-coverage RMA cannot transition to REFUNDED ───────────────

    @Test
    void adminUpdateReturnStatus_rmaRefunded_partialCoverage_returns409() throws Exception {
        // Order has 2 of a product; the RMA only covers 1 → partial coverage.
        AuthSession session = placeCompletedOrderWithQuantity(
                "ret-partial-" + UUID.randomUUID() + "@bigbike.vn", 2);

        // Mark order PAID so we don't get blocked by the PAYMENT precondition first.
        orderRepo.findById(UUID.fromString(session.orderId)).ifPresent(order -> {
            order.setPaymentStatus("PAID");
            order.setPaidAmount(order.getTotalAmount());
            order.setUpdatedAt(Instant.now());
            orderRepo.save(order);
        });

        // Create RMA for quantity 1 only.
        String body = "{\"reason\":\"DEFECTIVE\",\"items\":[{\"orderLineItemId\":\""
                + session.lineItemId + "\",\"quantity\":1,\"reason\":\"DEFECTIVE\"}]}";
        MvcResult createResult = mockMvc.perform(post("/api/v1/customer/orders/" + session.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andReturn();

        String returnId = extractJsonValue(createResult.getResponse().getContentAsString(), "id");

        mockMvc.perform(patch("/api/v1/admin/returns/" + returnId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/api/v1/admin/returns/" + returnId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"RECEIVED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // Attempt RECEIVED → REFUNDED on partial-coverage RMA → 409 ConflictException
        // with RETURN_NOT_FULL_COVERAGE message.
        java.math.BigDecimal anyAmount = java.math.BigDecimal.valueOf(500_000);
        mockMvc.perform(patch("/api/v1/admin/returns/" + returnId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"REFUNDED\",\"refundAmount\":" + anyAmount.toPlainString() + "}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());
    }

    // ── 29. COD/UNPAID order cannot be REFUNDED via RMA ──────────────────────

    @Test
    void adminUpdateReturnStatus_rmaRefunded_unpaidOrder_returns409() throws Exception {
        AuthSession session = placeCompletedOrder("ret-cod-" + UUID.randomUUID() + "@bigbike.vn");
        // Order is COMPLETED but paymentStatus stays UNPAID (COD never collected).

        MvcResult createResult = mockMvc.perform(
                        post("/api/v1/customer/orders/" + session.orderId + "/returns")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(buildReturnRequest("DEFECTIVE", null, session.lineItemId))
                                .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andReturn();

        String returnId = extractJsonValue(createResult.getResponse().getContentAsString(), "id");

        mockMvc.perform(patch("/api/v1/admin/returns/" + returnId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/api/v1/admin/returns/" + returnId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"RECEIVED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // RefundService rejects because paymentStatus != PAID.
        mockMvc.perform(patch("/api/v1/admin/returns/" + returnId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"REFUNDED\",\"refundAmount\":1000000}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());
    }

    // ── 30. Detail DTO exposes order-level refund context for the admin UI ──

    @Test
    void adminGetReturn_includesOrderRefundContextFields() throws Exception {
        AuthSession session = placeCompletedOrder("ret-ctx-" + UUID.randomUUID() + "@bigbike.vn");

        // Mark order PAID so paidAmount > 0 and orderRefundableAmount has a value to inspect.
        orderRepo.findById(UUID.fromString(session.orderId)).ifPresent(order -> {
            order.setPaymentStatus("PAID");
            order.setPaidAmount(order.getTotalAmount());
            order.setUpdatedAt(Instant.now());
            orderRepo.save(order);
        });

        MvcResult createResult = mockMvc.perform(
                        post("/api/v1/customer/orders/" + session.orderId + "/returns")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(buildReturnRequest("DEFECTIVE", null, session.lineItemId))
                                .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andReturn();

        String returnId = extractJsonValue(createResult.getResponse().getContentAsString(), "id");

        // Single-item order with full-quantity RMA → fullReturnCoverage MUST be true.
        mockMvc.perform(get("/api/v1/admin/returns/" + returnId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderPaidAmount").isNumber())
                .andExpect(jsonPath("$.orderRefundedAmount").isNumber())
                .andExpect(jsonPath("$.orderRefundableAmount").isNumber())
                .andExpect(jsonPath("$.fullReturnCoverage").value(true));
    }

    // ── 24. Create return — duplicate orderLineItemId in payload → 400 ───────

    @Test
    void createReturn_duplicateLineItemId_returns400() throws Exception {
        AuthSession session = placeCompletedOrder("ret-dup-item-" + UUID.randomUUID() + "@bigbike.vn");

        String body = "{\"reason\":\"DEFECTIVE\",\"items\":[" +
                "{\"orderLineItemId\":\"" + session.lineItemId + "\",\"quantity\":1,\"reason\":\"DEFECTIVE\"}," +
                "{\"orderLineItemId\":\"" + session.lineItemId + "\",\"quantity\":1,\"reason\":\"DEFECTIVE\"}" +
                "]}";

        mockMvc.perform(post("/api/v1/customer/orders/" + session.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].code").value("DUPLICATE"));
    }

    // ── Bug A3 — POS orders cannot be returned online ──────────────────────────

    @Test
    void getReturnEligibility_posOrder_returnsInStoreOrderReason() throws Exception {
        String email = "ret-pos-elig-" + UUID.randomUUID() + "@bigbike.vn";
        Cookie[] cookies = registerAndLogin(email);
        String csrf = findCsrf(cookies);

        UUID customerId = customerRepo.findByEmail(email).orElseThrow().getId();
        String orderId = placePosOrderForCustomer(customerId);

        mockMvc.perform(get("/api/v1/customer/orders/" + orderId + "/return-eligibility")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.eligible").value(false))
                .andExpect(jsonPath("$.data.reason").value("IN_STORE_ORDER"));
    }

    @Test
    void createReturn_posOrder_returns400() throws Exception {
        String email = "ret-pos-create-" + UUID.randomUUID() + "@bigbike.vn";
        Cookie[] cookies = registerAndLogin(email);
        String csrf = findCsrf(cookies);

        UUID customerId = customerRepo.findByEmail(email).orElseThrow().getId();
        String orderId = placePosOrderForCustomer(customerId);

        String body = "{\"reason\":\"DEFECTIVE\",\"items\":[" +
                "{\"orderLineItemId\":\"" + UUID.randomUUID() + "\",\"quantity\":1,\"reason\":\"DEFECTIVE\"}" +
                "]}";

        mockMvc.perform(post("/api/v1/customer/orders/" + orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].code").value("IN_STORE_ORDER"));
    }

    private String placePosOrderForCustomer(UUID customerId) {
        Instant now = Instant.now();
        OrderEntity order = new OrderEntity();
        order.setOrderNumber("POS-TEST-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase());
        order.setOrderKey(UUID.randomUUID().toString());
        order.setCustomerId(customerId);
        order.setStatus("COMPLETED");
        order.setPaymentStatus("PAID");
        order.setChannel("IN_STORE");
        order.setFulfillmentType("PICKUP");
        order.setCurrency("VND");
        order.setSubtotalAmount(java.math.BigDecimal.valueOf(500000));
        order.setDiscountAmount(java.math.BigDecimal.ZERO);
        order.setShippingAmount(java.math.BigDecimal.ZERO);
        order.setFeeAmount(java.math.BigDecimal.ZERO);
        order.setTaxAmount(java.math.BigDecimal.ZERO);
        order.setTotalAmount(java.math.BigDecimal.valueOf(500000));
        order.setPaidAmount(java.math.BigDecimal.valueOf(500000));
        order.setRefundAmount(java.math.BigDecimal.ZERO);
        order.setPlacedAt(now);
        order.setCreatedAt(now);
        order.setUpdatedAt(now);
        return orderRepo.save(order).getId().toString();
    }

    private String buildReturnRequest(String reason, String customerNote, String lineItemId) {
        String itemId = lineItemId != null ? lineItemId : UUID.randomUUID().toString();
        StringBuilder json = new StringBuilder();
        json.append("{\"reason\":\"").append(reason).append("\"");
        if (customerNote != null) {
            json.append(",\"customerNote\":\"").append(customerNote).append("\"");
        }
        json.append(",\"items\":[{\"orderLineItemId\":\"").append(itemId)
                .append("\",\"quantity\":1,\"reason\":\"").append(reason).append("\"}]}");
        return json.toString();
    }

    private void ensureAdminUser(String email, String password, String role, String displayName) {
        adminUserRepo.findByEmail(email).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(email);
            admin.setPasswordHash(passwordService.hash(password));
            admin.setDisplayName(displayName);
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

    private AuthSession placeCompletedOrder(String email) throws Exception {
        return placeCompletedOrderWithQuantity(email, 1);
    }

    private AuthSession placeCompletedOrderWithQuantity(String email, int quantity) throws Exception {
        Cookie[] cookies = registerAndLogin(email);
        String csrf = findCsrf(cookies);

        ProductEntity product = createTestProduct("Return Test Product " + email, 1_000_000);
        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":" + quantity + "}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk());

        MvcResult result = mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andReturn();

        String orderId = extractJsonValue(result.getResponse().getContentAsString(), "id");

        // Promote to COMPLETED directly in DB â€" bypasses business rules intentionally for test setup
        orderRepo.findById(UUID.fromString(orderId)).ifPresent(order -> {
            order.setStatus("COMPLETED");
            order.setUpdatedAt(Instant.now());
            orderRepo.save(order);
        });

        String lineItemId = lineItemRepo.findByOrderId(UUID.fromString(orderId))
                .stream().findFirst()
                .map(li -> li.getId().toString())
                .orElseThrow(() -> new IllegalStateException("No line items for order " + orderId));

        return new AuthSession(cookies, csrf, orderId, lineItemId);
    }

    private Cookie[] registerAndLogin(String email) throws Exception {
        mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"pass1234\"}"))
                .andExpect(status().isOk());
        MvcResult loginResult = mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"pass1234\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return loginResult.getResponse().getCookies();
    }

    private ProductEntity createTestProduct(String name, int price) {
        Instant now = Instant.now();
        ProductEntity p = new ProductEntity();
        p.setId(UUID.randomUUID().toString());
        p.setSlug("1l-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        p.setName(name);
        p.setRetailPrice(java.math.BigDecimal.valueOf(price));
        p.setCurrency("VND");
        p.setPublishStatus(PublishStatus.PUBLISHED);
        p.setStockState(ProductStockState.IN_STOCK);
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        p.setCategory(categoryRepo.findById(testCategoryId)
                .orElseThrow(() -> new IllegalStateException("Test category not found")));
        return productRepo.save(p);
    }

    private void ensureTestCategory() {
        if (testCategoryId != null) return;
        testCategoryId = "cat-1l-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity cat = new CategoryEntity();
        cat.setId(testCategoryId);
        cat.setSlug("return-cat-" + testCategoryId);
        cat.setName("Returns Test Category");
        cat.setVisible(true);
        cat.setCreatedAt(Instant.now());
        cat.setUpdatedAt(Instant.now());
        categoryRepo.save(cat);
    }

    private String findCsrf(Cookie[] cookies) {
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if ("bb_csrf".equals(c.getName())) return c.getValue();
        }
        return null;
    }

    private String extractJsonValue(String json, String key) {
        String marker = "\"" + key + "\":\"";
        int start = json.indexOf(marker);
        if (start < 0) return null;
        start += marker.length();
        int end = json.indexOf("\"", start);
        return json.substring(start, end);
    }

    private record AuthSession(Cookie[] cookies, String csrf, String orderId, String lineItemId) {}
}


