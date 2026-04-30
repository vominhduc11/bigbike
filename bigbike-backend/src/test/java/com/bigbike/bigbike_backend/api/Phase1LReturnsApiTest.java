package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
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

    private static final String VALID_BILLING = """
            {"fullName":"Test User","phone":"0909123456","email":"test@example.com",
             "addressLine1":"123 Test St","province":"HCM","country":"VN"}
            """;

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired ProductJpaRepository productRepo;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired OrderJpaRepository orderRepo;

    private MockMvc mockMvc;
    private static String testCategoryId;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureTestCategory();
    }

    // ── 1. Unauthenticated returns list → 401 ────────────────────────────────

    @Test
    void listReturns_withoutSession_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/customer/orders/returns"))
                .andExpect(status().isUnauthorized());
    }

    // ── 2. Empty returns list for new customer ────────────────────────────────

    @Test
    void listReturns_newCustomer_returnsEmptyArray() throws Exception {
        Cookie[] cookies = registerAndLogin("ret-empty-" + UUID.randomUUID() + "@bigbike.vn");

        MvcResult result = mockMvc.perform(get("/api/v1/customer/orders/returns").cookie(cookies))
                .andExpect(status().isOk())
                .andReturn();

        // Endpoint returns List<CustomerReturnResponse> directly — expect empty JSON array
        assertThat(result.getResponse().getContentAsString()).contains("[]");
    }

    // ── 3. Create return — unauthenticated → 401 ─────────────────────────────

    @Test
    void createReturn_withoutSession_returns401() throws Exception {
        mockMvc.perform(post("/api/v1/customer/orders/" + UUID.randomUUID() + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"DEFECTIVE\"}"))
                .andExpect(status().isUnauthorized());
    }

    // ── 4. Create return on non-existent order → 404 ─────────────────────────

    @Test
    void createReturn_nonExistentOrder_returns404() throws Exception {
        Cookie[] cookies = registerAndLogin("ret-404-" + UUID.randomUUID() + "@bigbike.vn");
        String csrf = findCsrf(cookies);

        mockMvc.perform(post("/api/v1/customer/orders/" + UUID.randomUUID() + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"DEFECTIVE\"}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isNotFound());
    }

    // ── 5. Create return — another customer's order → 404 ────────────────────

    @Test
    void createReturn_otherCustomerOrder_returns404() throws Exception {
        AuthSession sessionA = placeCompletedOrder("ret-owner-" + UUID.randomUUID() + "@bigbike.vn");
        Cookie[] cookiesB = registerAndLogin("ret-other-" + UUID.randomUUID() + "@bigbike.vn");
        String csrfB = findCsrf(cookiesB);

        mockMvc.perform(post("/api/v1/customer/orders/" + sessionA.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"DEFECTIVE\"}")
                        .cookie(cookiesB).header("X-CSRF-Token", csrfB))
                .andExpect(status().isNotFound());
    }

    // ── 6. Create return — valid COMPLETED order → 201 ───────────────────────

    @Test
    void createReturn_completedOrder_returns201WithReturnNumber() throws Exception {
        AuthSession session = placeCompletedOrder("ret-create-" + UUID.randomUUID() + "@bigbike.vn");

        MvcResult result = mockMvc.perform(post("/api/v1/customer/orders/" + session.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"DEFECTIVE\",\"customerNote\":\"Product is broken\"}")
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

    // ── 7. Return appears in list after creation ──────────────────────────────

    @Test
    void listReturns_afterCreation_containsReturn() throws Exception {
        AuthSession session = placeCompletedOrder("ret-list-" + UUID.randomUUID() + "@bigbike.vn");

        mockMvc.perform(post("/api/v1/customer/orders/" + session.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"WRONG_ITEM\"}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated());

        MvcResult listResult = mockMvc.perform(get("/api/v1/customer/orders/returns").cookie(session.cookies))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(listResult.getResponse().getContentAsString()).contains("WRONG_ITEM");
    }

    // ── 8. Fetch return detail by ID ──────────────────────────────────────────

    @Test
    void getReturn_ownReturn_returnsFullDetail() throws Exception {
        AuthSession session = placeCompletedOrder("ret-detail-" + UUID.randomUUID() + "@bigbike.vn");

        MvcResult createResult = mockMvc.perform(
                        post("/api/v1/customer/orders/" + session.orderId + "/returns")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"reason\":\"NOT_AS_DESCRIBED\",\"customerNote\":\"Looks different\"}")
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

    // ── 9. Another customer cannot fetch return by ID ─────────────────────────

    @Test
    void getReturn_otherCustomer_returns404() throws Exception {
        AuthSession sessionA = placeCompletedOrder("ret-sec-a-" + UUID.randomUUID() + "@bigbike.vn");

        MvcResult createResult = mockMvc.perform(
                        post("/api/v1/customer/orders/" + sessionA.orderId + "/returns")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"reason\":\"DEFECTIVE\"}")
                                .cookie(sessionA.cookies).header("X-CSRF-Token", sessionA.csrf))
                .andExpect(status().isCreated())
                .andReturn();

        String returnId = extractJsonValue(createResult.getResponse().getContentAsString(), "id");
        Cookie[] cookiesB = registerAndLogin("ret-sec-b-" + UUID.randomUUID() + "@bigbike.vn");

        mockMvc.perform(get("/api/v1/customer/orders/returns/" + returnId).cookie(cookiesB))
                .andExpect(status().isNotFound());
    }

    // ── 10. Duplicate return on same order → 400 ─────────────────────────────

    @Test
    void createReturn_duplicate_returns400() throws Exception {
        AuthSession session = placeCompletedOrder("ret-dup-" + UUID.randomUUID() + "@bigbike.vn");

        // First return — 201 CREATED
        mockMvc.perform(post("/api/v1/customer/orders/" + session.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"DEFECTIVE\"}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated());

        // Second return on same order with active PENDING return → 400 (ValidationException)
        mockMvc.perform(post("/api/v1/customer/orders/" + session.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"CHANGED_MIND\"}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest());
    }

    // ── 11. Admin: list returns — no auth → 401 ───────────────────────────────

    @Test
    void adminListReturns_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/returns"))
                .andExpect(status().isUnauthorized());
    }

    // ── 12. Admin: list returns — authenticated → 200 with items + pagination ─

    @Test
    void adminListReturns_authenticated_returnsPaginatedResult() throws Exception {
        // PageResult serializes as {items:[...], page:N, pageSize:N, totalItems:N, totalPages:N}
        mockMvc.perform(get("/api/v1/admin/returns")
                        .header("X-Admin-Role", "ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.totalPages").isNumber());
    }

    // ── 13. Admin: get return detail → 200 ───────────────────────────────────

    @Test
    void adminGetReturn_existingReturn_returnsDetail() throws Exception {
        AuthSession session = placeCompletedOrder("ret-admin-det-" + UUID.randomUUID() + "@bigbike.vn");

        MvcResult createResult = mockMvc.perform(
                        post("/api/v1/customer/orders/" + session.orderId + "/returns")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"reason\":\"DEFECTIVE\"}")
                                .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andReturn();

        String returnId = extractJsonValue(createResult.getResponse().getContentAsString(), "id");

        // AdminReturnDetailResponse returned directly (not wrapped in {data:})
        mockMvc.perform(get("/api/v1/admin/returns/" + returnId)
                        .header("X-Admin-Role", "ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(returnId))
                .andExpect(jsonPath("$.orderNumber").isString())
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    // ── 14. Admin: update return status → APPROVED ───────────────────────────

    @Test
    void adminUpdateReturnStatus_toApproved_succeeds() throws Exception {
        AuthSession session = placeCompletedOrder("ret-approve-" + UUID.randomUUID() + "@bigbike.vn");

        MvcResult createResult = mockMvc.perform(
                        post("/api/v1/customer/orders/" + session.orderId + "/returns")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"reason\":\"DEFECTIVE\"}")
                                .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andReturn();

        String returnId = extractJsonValue(createResult.getResponse().getContentAsString(), "id");

        // PATCH returns AdminReturnDetailResponse directly
        mockMvc.perform(patch("/api/v1/admin/returns/" + returnId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\",\"adminNote\":\"OK to return\"}")
                        .header("X-Admin-Role", "ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));
    }

    // ── 15. Admin: update return status — VIEWER role → 403 ──────────────────

    @Test
    void adminUpdateReturnStatus_viewerRole_returns403() throws Exception {
        AuthSession session = placeCompletedOrder("ret-viewer-" + UUID.randomUUID() + "@bigbike.vn");

        MvcResult createResult = mockMvc.perform(
                        post("/api/v1/customer/orders/" + session.orderId + "/returns")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"reason\":\"DEFECTIVE\"}")
                                .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andReturn();

        String returnId = extractJsonValue(createResult.getResponse().getContentAsString(), "id");

        // VIEWER has only read permissions — write → 403
        mockMvc.perform(patch("/api/v1/admin/returns/" + returnId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\"}")
                        .header("X-Admin-Role", "VIEWER"))
                .andExpect(status().isForbidden());
    }

    // ── 16. Admin: search returns by order number prefix ─────────────────────

    @Test
    void adminListReturns_searchByOrderNumber_filtersResults() throws Exception {
        AuthSession session = placeCompletedOrder("ret-search-" + UUID.randomUUID() + "@bigbike.vn");

        mockMvc.perform(post("/api/v1/customer/orders/" + session.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"DEFECTIVE\"}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated());

        // Search with "BB-" prefix (all order numbers start with BB-)
        mockMvc.perform(get("/api/v1/admin/returns")
                        .param("q", "BB-")
                        .header("X-Admin-Role", "ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());
    }

    // ── 17. Admin: filter by status ───────────────────────────────────────────

    @Test
    void adminListReturns_filterByStatus_returnsPendingOnly() throws Exception {
        AuthSession session = placeCompletedOrder("ret-flt-" + UUID.randomUUID() + "@bigbike.vn");

        mockMvc.perform(post("/api/v1/customer/orders/" + session.orderId + "/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"OTHER\"}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated());

        MvcResult result = mockMvc.perform(get("/api/v1/admin/returns")
                        .param("status", "PENDING")
                        .header("X-Admin-Role", "ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        // All items must have PENDING status — no APPROVED or REJECTED in filtered result
        assertThat(body).doesNotContain("\"status\":\"APPROVED\"");
        assertThat(body).doesNotContain("\"status\":\"REJECTED\"");
    }

    // ── 18. Admin: detail includes orderNumber + customerEmail ────────────────

    @Test
    void adminGetReturn_includesOrderNumberAndCustomerEmail() throws Exception {
        String email = "ret-meta-" + UUID.randomUUID() + "@bigbike.vn";
        AuthSession session = placeCompletedOrder(email);

        MvcResult createResult = mockMvc.perform(
                        post("/api/v1/customer/orders/" + session.orderId + "/returns")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"reason\":\"DEFECTIVE\"}")
                                .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andReturn();

        String returnId = extractJsonValue(createResult.getResponse().getContentAsString(), "id");

        MvcResult detailResult = mockMvc.perform(get("/api/v1/admin/returns/" + returnId)
                        .header("X-Admin-Role", "ADMIN"))
                .andExpect(status().isOk())
                .andReturn();

        String body = detailResult.getResponse().getContentAsString();
        assertThat(body).contains("orderNumber");
        assertThat(body).contains("customerEmail");
        assertThat(body).contains(email);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Register → login → checkout → promote order to COMPLETED in DB so it is returnable.
     */
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

        // Promote to COMPLETED directly in DB — bypasses business rules intentionally for test setup
        orderRepo.findById(UUID.fromString(orderId)).ifPresent(order -> {
            order.setStatus("COMPLETED");
            order.setUpdatedAt(Instant.now());
            orderRepo.save(order);
        });

        return new AuthSession(cookies, csrf, orderId);
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

    private record AuthSession(Cookie[] cookies, String csrf, String orderId) {}
}
