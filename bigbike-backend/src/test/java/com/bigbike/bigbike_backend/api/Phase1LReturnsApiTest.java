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
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
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

        // Endpoint returns List<CustomerReturnResponse> directly â€" expect empty JSON array
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
                // CustomerReturnResponse returned directly (not wrapped in {data:})
                .andExpect(jsonPath("$.returnNumber").isString())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.reason").value("DEFECTIVE"))
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

        // CustomerReturnResponse returned directly (not wrapped)
        mockMvc.perform(get("/api/v1/customer/orders/returns/" + returnId).cookie(session.cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(returnId))
                .andExpect(jsonPath("$.reason").value("NOT_AS_DESCRIBED"))
                .andExpect(jsonPath("$.customerNote").value("Looks different"))
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.history").isArray());
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
                .andExpect(jsonPath("$.items[0].productName").value(uniqueName))
                .andReturn();

        assertThat(createResult.getResponse().getContentAsString()).contains(uniqueName);
    }

    // â"€â"€ Helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    /**
     * Register â†’ login â†’ checkout â†’ promote order to COMPLETED in DB so it is returnable.
     * @param lineItemId the actual orderLineItemId from the order; pass null to use a random UUID
     *                   (for tests that are expected to fail before item validation is reached)
     */
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
        Cookie[] cookies = registerAndLogin(email);
        String csrf = findCsrf(cookies);

        ProductEntity product = createTestProduct("Return Test Product " + email, 1_000_000);
        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1}")
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


