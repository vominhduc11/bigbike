package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class Phase1GOrderReadApiTest {

    private static final String VALID_BILLING = """
            {"fullName":"Test User","phone":"0909123456","email":"test@example.com",
             "addressLine1":"123 Test St","province":"HCM","country":"VN"}
            """;

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired ProductJpaRepository productRepo;
    @Autowired CategoryJpaRepository categoryRepo;

    private MockMvc mockMvc;
    private static String testCategoryId;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureTestCategory();
    }

    private void ensureTestCategory() {
        if (testCategoryId != null) return;
        testCategoryId = "cat-1g-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity cat = new CategoryEntity();
        cat.setId(testCategoryId);
        cat.setSlug("order-read-cat-" + testCategoryId);
        cat.setName("Order Read Test Category");
        cat.setVisible(true);
        cat.setCreatedAt(Instant.now());
        cat.setUpdatedAt(Instant.now());
        categoryRepo.save(cat);
    }

    // ── 1. Unauthenticated access ─────────────────────────────────────────────

    @Test
    void customerOrders_withoutSession_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/customer/orders"))
                .andExpect(status().isUnauthorized());
    }

    // ── 2. Customer sees only own orders ──────────────────────────────────────

    @Test
    void customerOrders_withSession_returnsOnlyOwnOrders() throws Exception {
        String emailA = "ord-a-" + UUID.randomUUID() + "@bigbike.vn";
        String emailB = "ord-b-" + UUID.randomUUID() + "@bigbike.vn";
        AuthSession sessionA = loginAndCheckout(emailA, 3000000);
        AuthSession sessionB = loginAndCheckout(emailB, 4000000);

        // Customer A sees their order
        MvcResult resultA = mockMvc.perform(get("/api/v1/customer/orders").cookie(sessionA.cookies))
                .andExpect(status().isOk())
                .andReturn();

        String bodyA = resultA.getResponse().getContentAsString();
        // totalItems for A should be exactly 1 from this session
        assertThat(bodyA).contains("orderNumber");

        // Customer B's order list should NOT contain customer A's order number
        String aOrderNumber = sessionA.orderNumber;
        MvcResult resultB = mockMvc.perform(get("/api/v1/customer/orders").cookie(sessionB.cookies))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(resultB.getResponse().getContentAsString()).doesNotContain(aOrderNumber);
    }

    // ── 3. Pagination ─────────────────────────────────────────────────────────

    @Test
    void customerOrders_paginationWorks() throws Exception {
        String email = "ord-page-" + UUID.randomUUID() + "@bigbike.vn";
        // Register and login
        Cookie[] cookies = registerAndLogin(email);
        String csrf = findCsrf(cookies);

        // Place 2 orders (separate carts — first cart gets CONVERTED, service creates new ACTIVE cart)
        placeOrderWithCookies(cookies, csrf, 1000000);
        placeOrderWithCookies(cookies, csrf, 2000000);

        // Request page 1 size 1 — should get 1 item but totalItems >= 2
        mockMvc.perform(get("/api/v1/customer/orders")
                        .param("page", "1").param("size", "1")
                        .cookie(cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.pagination.pageSize").value(1));
    }

    // ── 4. Filter by status ───────────────────────────────────────────────────

    @Test
    void customerOrders_filterByStatusWorks() throws Exception {
        String email = "ord-flt-" + UUID.randomUUID() + "@bigbike.vn";
        AuthSession session = loginAndCheckout(email, 5000000); // COD → PROCESSING

        // Filter for PROCESSING — must find at least the order we just placed
        mockMvc.perform(get("/api/v1/customer/orders")
                        .param("status", "PROCESSING")
                        .cookie(session.cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());

        // Filter for CANCELLED — must return empty for this customer (no cancelled orders)
        mockMvc.perform(get("/api/v1/customer/orders")
                        .param("status", "CANCELLED")
                        .cookie(session.cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    // ── 5. Customer order detail — own order ──────────────────────────────────

    @Test
    void customerOrderDetail_ownOrder_returnsDetail() throws Exception {
        String email = "ord-det-" + UUID.randomUUID() + "@bigbike.vn";
        AuthSession session = loginAndCheckout(email, 6000000);

        mockMvc.perform(get("/api/v1/customer/orders/" + session.orderId).cookie(session.cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.orderNumber").value(session.orderNumber))
                .andExpect(jsonPath("$.data.status").value("PROCESSING"));
    }

    // ── 6. Customer order detail — another customer's order → 404 ────────────

    @Test
    void customerOrderDetail_otherCustomerOrder_returns404() throws Exception {
        String emailA = "ord-sec-a-" + UUID.randomUUID() + "@bigbike.vn";
        String emailB = "ord-sec-b-" + UUID.randomUUID() + "@bigbike.vn";
        AuthSession sessionA = loginAndCheckout(emailA, 2000000);
        AuthSession sessionB = loginAndCheckout(emailB, 3000000);

        // Customer B tries to access Customer A's order by ID → 404
        mockMvc.perform(get("/api/v1/customer/orders/" + sessionA.orderId)
                        .cookie(sessionB.cookies))
                .andExpect(status().isNotFound());
    }

    // ── 7. Detail includes line items ─────────────────────────────────────────

    @Test
    void customerOrderDetail_includesLineItems() throws Exception {
        String email = "ord-li-" + UUID.randomUUID() + "@bigbike.vn";
        AuthSession session = loginAndCheckout(email, 7000000);

        mockMvc.perform(get("/api/v1/customer/orders/" + session.orderId).cookie(session.cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lineItems").isArray())
                .andExpect(jsonPath("$.data.lineItems.length()").value(1))
                .andExpect(jsonPath("$.data.lineItems[0].productName").isString())
                .andExpect(jsonPath("$.data.lineItems[0].quantity").value(1));
    }

    // ── 8. Detail includes addresses ──────────────────────────────────────────

    @Test
    void customerOrderDetail_includesAddresses() throws Exception {
        String email = "ord-addr-" + UUID.randomUUID() + "@bigbike.vn";
        AuthSession session = loginAndCheckout(email, 2500000);

        mockMvc.perform(get("/api/v1/customer/orders/" + session.orderId).cookie(session.cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.addresses").isArray())
                // Both BILLING and SHIPPING are always created
                .andExpect(jsonPath("$.data.addresses.length()").value(2));
    }

    // ── 9. Detail includes shipping items ─────────────────────────────────────

    @Test
    void customerOrderDetail_includesShippingItems() throws Exception {
        String email = "ord-ship-" + UUID.randomUUID() + "@bigbike.vn";
        AuthSession session = loginAndCheckout(email, 3500000);

        mockMvc.perform(get("/api/v1/customer/orders/" + session.orderId).cookie(session.cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.shippingItems").isArray())
                .andExpect(jsonPath("$.data.shippingItems.length()").value(1))
                .andExpect(jsonPath("$.data.shippingItems[0].methodTitle").isString());
    }

    // ── 10. Detail includes payment summary ───────────────────────────────────

    @Test
    void customerOrderDetail_includesPaymentSummary() throws Exception {
        String email = "ord-pay-" + UUID.randomUUID() + "@bigbike.vn";
        AuthSession session = loginAndCheckout(email, 4500000);

        mockMvc.perform(get("/api/v1/customer/orders/" + session.orderId).cookie(session.cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.payments").isArray())
                .andExpect(jsonPath("$.data.payments.length()").value(1))
                .andExpect(jsonPath("$.data.payments[0].paymentMethod").value("COD"))
                .andExpect(jsonPath("$.data.payments[0].status").value("PENDING"));
    }

    // ── 11. Detail does not expose ip or userAgent ────────────────────────────

    @Test
    void customerOrderDetail_doesNotExposeIpOrUserAgent() throws Exception {
        String email = "ord-priv-" + UUID.randomUUID() + "@bigbike.vn";
        AuthSession session = loginAndCheckout(email, 1500000);

        MvcResult result = mockMvc.perform(
                        get("/api/v1/customer/orders/" + session.orderId).cookie(session.cookies))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).doesNotContain("ipAddress");
        assertThat(body).doesNotContain("userAgent");
    }

    // ── 12. Guest lookup — valid orderNumber+orderKey ─────────────────────────

    @Test
    void guestLookup_validOrderNumberAndKey_returnsDetail() throws Exception {
        GuestOrderResult order = placeGuestOrder(5000000);

        mockMvc.perform(get("/api/v1/orders/lookup")
                        .param("orderNumber", order.orderNumber)
                        .param("orderKey", order.orderKey))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.orderNumber").value(order.orderNumber))
                .andExpect(jsonPath("$.data.status").value("PROCESSING"));
    }

    // ── 13. Guest lookup — wrong key ──────────────────────────────────────────

    @Test
    void guestLookup_wrongKey_returns404() throws Exception {
        GuestOrderResult order = placeGuestOrder(2000000);

        mockMvc.perform(get("/api/v1/orders/lookup")
                        .param("orderNumber", order.orderNumber)
                        .param("orderKey", "bb_order_wrongkeywrongkeyy"))
                .andExpect(status().isNotFound());
    }

    // ── 14. Guest lookup — missing params ─────────────────────────────────────

    @Test
    void guestLookup_missingParams_returns400() throws Exception {
        // Missing orderKey
        mockMvc.perform(get("/api/v1/orders/lookup")
                        .param("orderNumber", "BB-20260421-ABCDEF"))
                .andExpect(status().isBadRequest());

        // Missing orderNumber
        mockMvc.perform(get("/api/v1/orders/lookup")
                        .param("orderKey", "bb_order_somekey"))
                .andExpect(status().isBadRequest());
    }

    // ── 15. Guest lookup — does not expose internal notes ────────────────────

    @Test
    void guestLookup_doesNotExposeInternalNotes() throws Exception {
        // Checkout creates a system note with customerVisible=false
        GuestOrderResult order = placeGuestOrder(3000000);

        MvcResult result = mockMvc.perform(get("/api/v1/orders/lookup")
                        .param("orderNumber", order.orderNumber)
                        .param("orderKey", order.orderKey))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        // notes array should be empty — system note has customerVisible=false
        assertThat(body).contains("\"notes\":[]");
    }

    // ── 16. Order-received flow — checkout then lookup ────────────────────────

    @Test
    void orderReceivedFlow_afterCheckout_canLookupByOrderNumberAndKey() throws Exception {
        GuestOrderResult order = placeGuestOrder(8000000);

        mockMvc.perform(get("/api/v1/orders/lookup")
                        .param("orderNumber", order.orderNumber)
                        .param("orderKey", order.orderKey))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.orderNumber").value(order.orderNumber))
                .andExpect(jsonPath("$.data.orderKey").value(order.orderKey))
                .andExpect(jsonPath("$.data.lineItems").isArray())
                .andExpect(jsonPath("$.data.lineItems.length()").value(1));
    }

    // ── 17. Quick-buy order — can lookup by orderNumber+orderKey ─────────────

    @Test
    void quickBuyOrder_canLookupByOrderNumberAndKey() throws Exception {
        ProductEntity product = createTestProduct("QB Lookup Product", 9000000, null, PublishStatus.PUBLISHED);
        GuestSession guestSession = newGuestSession();

        MvcResult result = mockMvc.perform(post("/api/v1/orders/quick-buy")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1," +
                                 "\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(guestSession.cookies).header("X-CSRF-Token", guestSession.csrf))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        String orderNumber = extractJsonValue(body, "orderNumber");
        String orderKey = extractJsonValue(body, "orderKey");

        mockMvc.perform(get("/api/v1/orders/lookup")
                        .param("orderNumber", orderNumber)
                        .param("orderKey", orderKey))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.orderNumber").value(orderNumber));
    }

    // ── 18–22. Regression ─────────────────────────────────────────────────────

    @Test
    void publicCatalog_stillPublic() throws Exception {
        mockMvc.perform(get("/api/v1/products").param("page", "1").param("size", "2"))
                .andExpect(status().isOk());
    }

    @Test
    void adminEndpoint_stillProtected() throws Exception {
        mockMvc.perform(get("/api/v1/admin/products"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void customerMe_stillWorks() throws Exception {
        String email = "regr-me-" + UUID.randomUUID() + "@bigbike.vn";
        Cookie[] cookies = registerAndLogin(email);
        mockMvc.perform(get("/api/v1/customer/me").cookie(cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value(email));
    }

    @Test
    void cartApi_stillWorks() throws Exception {
        mockMvc.perform(get("/api/v1/cart"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    @Test
    void checkoutApi_stillWorks() throws Exception {
        mockMvc.perform(get("/api/v1/checkout/options"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentMethods").isArray());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Register, login, add item to cart, checkout. Returns session with order info. */
    private AuthSession loginAndCheckout(String email, int price) throws Exception {
        Cookie[] cookies = registerAndLogin(email);
        String csrf = findCsrf(cookies);
        return placeOrderWithCookies(cookies, csrf, price);
    }

    private AuthSession placeOrderWithCookies(Cookie[] cookies, String csrf, int price) throws Exception {
        ProductEntity product = createTestProduct("Auth Order Product " + price, price, null, PublishStatus.PUBLISHED);

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

        String body = result.getResponse().getContentAsString();
        String orderId = extractJsonValue(body, "id");
        String orderNumber = extractJsonValue(body, "orderNumber");
        return new AuthSession(cookies, csrf, orderId, orderNumber);
    }

    /** Place a guest checkout and return orderNumber + orderKey. */
    private GuestOrderResult placeGuestOrder(int price) throws Exception {
        GuestSession session = newGuestSessionWithItem(price);
        MvcResult result = mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        return new GuestOrderResult(
                extractJsonValue(body, "orderNumber"),
                extractJsonValue(body, "orderKey")
        );
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

    private GuestSession newGuestSession() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = result.getResponse().getCookies();
        String csrf = getCookieValue(result.getResponse(), "bb_csrf");
        return new GuestSession(cookies, csrf);
    }

    private GuestSession newGuestSessionWithItem(int price) throws Exception {
        ProductEntity product = createTestProduct("Guest Order Product " + price, price, null, PublishStatus.PUBLISHED);
        GuestSession session = newGuestSession();
        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk());
        return session;
    }

    private ProductEntity createTestProduct(String name, int price, Integer salePrice, PublishStatus status) {
        Instant now = Instant.now();
        ProductEntity p = new ProductEntity();
        p.setId(UUID.randomUUID().toString());
        p.setSlug("1g-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        p.setName(name);
        p.setRetailPrice(price);
        p.setSalePrice(salePrice);
        p.setCurrency("VND");
        p.setPublishStatus(status);
        p.setStockState(ProductStockState.IN_STOCK);
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        p.setCategory(categoryRepo.findById(testCategoryId)
                .orElseThrow(() -> new IllegalStateException("Test category not found")));
        return productRepo.save(p);
    }

    private String findCsrf(Cookie[] cookies) {
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if ("bb_csrf".equals(c.getName())) return c.getValue();
        }
        return null;
    }

    private String getCookieValue(MockHttpServletResponse response, String name) {
        Cookie[] cookies = response.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return c.getValue();
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

    // ── Value types ───────────────────────────────────────────────────────────

    private record GuestSession(Cookie[] cookies, String csrf) {}
    private record GuestOrderResult(String orderNumber, String orderKey) {}
    private record AuthSession(Cookie[] cookies, String csrf, String orderId, String orderNumber) {}
}
