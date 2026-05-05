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
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class Phase1FCheckoutApiTest {

    // Known seed IDs from V1001__seed_settings_menu_shipping_dev.sql
    private static final String COD_METHOD_ID = "00000000-0000-0000-0000-000000000401";
    private static final String FLAT_RATE_METHOD_ID = "00000000-0000-0000-0000-000000000402";

    private static final String VALID_BILLING = """
            {"fullName":"Nguyen Van A","phone":"0909123456","email":"buyer@example.com",
             "addressLine1":"123 Duong ABC","province":"HCM","country":"VN"}
            """;

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired CartJpaRepository cartRepo;
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

    private void ensureTestCategory() {
        if (testCategoryId != null) return;
        testCategoryId = "cat-chk-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity cat = new CategoryEntity();
        cat.setId(testCategoryId);
        cat.setSlug("checkout-category-" + testCategoryId);
        cat.setName("Checkout Test Category");
        cat.setVisible(true);
        cat.setCreatedAt(Instant.now());
        cat.setUpdatedAt(Instant.now());
        categoryRepo.save(cat);
    }

    // ── Checkout options (2) ──────────────────────────────────────────────────

    @Test
    void getOptions_returnsPaymentAndShippingMethods() throws Exception {
        mockMvc.perform(get("/api/v1/checkout/options"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentMethods").isArray())
                .andExpect(jsonPath("$.data.paymentMethods.length()").value(2))
                .andExpect(jsonPath("$.data.shippingMethods").isArray())
                // Only 1 enabled shipping method in seed (COD, flat_rate is disabled)
                .andExpect(jsonPath("$.data.shippingMethods.length()").value(1))
                .andExpect(jsonPath("$.data.shippingMethods[0].code").value("cod"));
    }

    @Test
    void getOptions_doesNotRequireCsrf() throws Exception {
        // GET is CSRF-safe — no cookies or header needed
        mockMvc.perform(get("/api/v1/checkout/options"))
                .andExpect(status().isOk());
    }

    // ── CSRF protection (2) ───────────────────────────────────────────────────

    @Test
    void checkout_missingCsrf_returns403() throws Exception {
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("CSRF_INVALID"));
    }

    @Test
    void quickBuy_missingCsrf_returns403() throws Exception {
        mockMvc.perform(post("/api/v1/orders/quick-buy")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"any\",\"quantity\":1,\"paymentMethod\":\"COD\"," +
                                 "\"billingAddress\":" + VALID_BILLING + "}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("CSRF_INVALID"));
    }

    // ── Checkout validation (6) ───────────────────────────────────────────────

    @Test
    void checkout_emptyCart_returns400() throws Exception {
        GuestSession session = newGuestSession();
        // No items added — empty cart
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest());
    }

    @Test
    void checkout_invalidPaymentMethod_returns400() throws Exception {
        GuestSession session = newGuestSessionWithItem(5000000);
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"PAYPAL\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest());
    }

    @Test
    void checkout_missingFullName_returns400() throws Exception {
        GuestSession session = newGuestSessionWithItem(5000000);
        String billing = """
                {"phone":"0909123456","email":"a@b.com","addressLine1":"123 Rd"}
                """;
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + billing + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest());
    }

    @Test
    void checkout_missingPhone_returns400() throws Exception {
        GuestSession session = newGuestSessionWithItem(5000000);
        String billing = """
                {"fullName":"Test","email":"a@b.com","addressLine1":"123 Rd"}
                """;
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + billing + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest());
    }

    @Test
    void checkout_invalidPhone_returns400() throws Exception {
        GuestSession session = newGuestSessionWithItem(5000000);
        String billing = """
                {"fullName":"Test","phone":"090912345","email":"a@b.com","addressLine1":"123 Rd"}
                """;
        // 9 digits — invalid
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + billing + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest());
    }

    @Test
    void checkout_missingAddressLine1_returns400() throws Exception {
        GuestSession session = newGuestSessionWithItem(5000000);
        String billing = """
                {"fullName":"Test","phone":"0909123456","email":"a@b.com"}
                """;
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + billing + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest());
    }

    // ── Shipping method selection (3) ─────────────────────────────────────────

    @Test
    void checkout_shippingMethodAutoSelected_whenOnlyOneEnabled() throws Exception {
        GuestSession session = newGuestSessionWithItem(3000000);
        // No shippingMethodId — auto-selects the single enabled COD method
        MvcResult result = mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("orderNumber");
    }

    @Test
    void checkout_shippingMethodById_accepted() throws Exception {
        GuestSession session = newGuestSessionWithItem(3000000);
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"shippingMethodId\":\"" + COD_METHOD_ID + "\"," +
                                 "\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.orderNumber").isString());
    }

    @Test
    void checkout_disabledShippingMethod_returns400() throws Exception {
        GuestSession session = newGuestSessionWithItem(3000000);
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"shippingMethodId\":\"" + FLAT_RATE_METHOD_ID + "\"," +
                                 "\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest());
    }

    // ── Guest checkout happy paths (5) ────────────────────────────────────────

    @Test
    void checkout_guestCOD_createsOrder_status_PROCESSING() throws Exception {
        GuestSession session = newGuestSessionWithItem(4500000);
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PROCESSING"))
                .andExpect(jsonPath("$.data.paymentMethod").value("COD"))
                .andExpect(jsonPath("$.data.orderNumber").isString())
                .andExpect(jsonPath("$.data.orderKey").isString());
    }

    @Test
    void checkout_guestBACS_createsOrder_status_ON_HOLD() throws Exception {
        GuestSession session = newGuestSessionWithItem(2000000);
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"BACS\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ON_HOLD"))
                .andExpect(jsonPath("$.data.paymentMethod").value("BACS"));
    }

    @Test
    void checkout_guestOrder_paymentStatus_UNPAID() throws Exception {
        GuestSession session = newGuestSessionWithItem(1000000);
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentStatus").value("UNPAID"));
    }

    @Test
    void checkout_guestOrder_totalMatchesCartItems() throws Exception {
        GuestSession session = newGuestSessionWithItem(3000000, 2); // 2 units × 3,000,000
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                // COD cost=0, so total = subtotal = 6,000,000
                .andExpect(jsonPath("$.data.subtotalAmount").value(6000000.00))
                .andExpect(jsonPath("$.data.totalAmount").value(6000000.00))
                .andExpect(jsonPath("$.data.shippingAmount").value(0.00));
    }

    @Test
    void checkout_cartMarkedConverted_afterCheckout() throws Exception {
        GuestSession session = newGuestSessionWithItem(5000000);
        // Find the cart before checkout
        String guestId = getCookieValue(session, "bb_guest_id");
        Optional<CartEntity> cartBefore = cartRepo.findBySessionId(guestId);
        assertThat(cartBefore).isPresent();
        assertThat(cartBefore.get().getStatus()).isEqualTo("ACTIVE");

        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk());

        // Cart must now be CONVERTED
        Optional<CartEntity> cartAfter = cartRepo.findById(cartBefore.get().getId());
        assertThat(cartAfter).isPresent();
        assertThat(cartAfter.get().getStatus()).isEqualTo("CONVERTED");
    }

    // ── Authenticated checkout (2) ────────────────────────────────────────────

    @Test
    void checkout_authenticatedCustomer_createsOrder() throws Exception {
        String email = "chk-auth-" + UUID.randomUUID() + "@bigbike.vn";
        AuthSession session = loginAndAddItem(email, 7000000);

        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PROCESSING"))
                .andExpect(jsonPath("$.data.orderNumber").isString());
    }

    @Test
    void checkout_authenticatedCustomer_orderInDB() throws Exception {
        String email = "chk-auth2-" + UUID.randomUUID() + "@bigbike.vn";
        AuthSession session = loginAndAddItem(email, 4000000);

        MvcResult result = mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"BACS\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        String orderNumber = extractJsonValue(body, "orderNumber");
        assertThat(orderRepo.findByOrderNumber(orderNumber)).isPresent();
    }

    // ── Shipping address (1) ──────────────────────────────────────────────────

    @Test
    void checkout_shippingAddress_sameAsBilling_accepted() throws Exception {
        GuestSession session = newGuestSessionWithItem(2000000);
        String shipping = "{\"sameAsBilling\":true}";
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING +
                                 ",\"shippingAddress\":" + shipping + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PROCESSING"));
    }

    // ── Quick-buy happy paths (2) ─────────────────────────────────────────────

    @Test
    void quickBuy_guestCOD_createsOrder() throws Exception {
        ProductEntity product = createTestProduct("Quick Buy Product", 6000000, null, PublishStatus.PUBLISHED);
        GuestSession session = newGuestSession();

        mockMvc.perform(post("/api/v1/orders/quick-buy")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1," +
                                 "\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PROCESSING"))
                .andExpect(jsonPath("$.data.paymentMethod").value("COD"))
                .andExpect(jsonPath("$.data.subtotalAmount").value(6000000.00))
                .andExpect(jsonPath("$.data.orderNumber").isString());
    }

    @Test
    void quickBuy_guestBACS_createsOrder_statusOnHold() throws Exception {
        ProductEntity product = createTestProduct("QB BACS Product", 3500000, null, PublishStatus.PUBLISHED);
        GuestSession session = newGuestSession();

        mockMvc.perform(post("/api/v1/orders/quick-buy")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":2," +
                                 "\"paymentMethod\":\"BACS\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ON_HOLD"))
                .andExpect(jsonPath("$.data.paymentMethod").value("BACS"))
                .andExpect(jsonPath("$.data.subtotalAmount").value(7000000.00));
    }

    // ── Quick-buy validation (3) ──────────────────────────────────────────────

    @Test
    void quickBuy_productNotFound_returns404() throws Exception {
        GuestSession session = newGuestSession();
        mockMvc.perform(post("/api/v1/orders/quick-buy")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"nonexistent-product-id\",\"quantity\":1," +
                                 "\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isNotFound());
    }

    @Test
    void quickBuy_unpublishedProduct_returns409() throws Exception {
        ProductEntity draft = createTestProduct("Draft Product QB", 2000000, null, PublishStatus.DRAFT);
        GuestSession session = newGuestSession();

        mockMvc.perform(post("/api/v1/orders/quick-buy")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + draft.getId() + "\",\"quantity\":1," +
                                 "\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isConflict());
    }

    @Test
    void quickBuy_invalidPaymentMethod_returns400() throws Exception {
        ProductEntity product = createTestProduct("QB Payment Validation", 1000000, null, PublishStatus.PUBLISHED);
        GuestSession session = newGuestSession();

        mockMvc.perform(post("/api/v1/orders/quick-buy")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1," +
                                 "\"paymentMethod\":\"CREDIT_CARD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest());
    }

    @Test
    void checkout_sameIdempotencyKey_returnsExistingOrder_andDoesNotDecrementStockTwice() throws Exception {
        ProductEntity product = createTrackedProduct("Idempotent Checkout Product", 2500000, 5);
        GuestSession session = newGuestSession();
        addProductToGuestCart(session, product.getId(), 2);
        long ordersBefore = orderRepo.count();
        String payload = "{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}";
        String idempotencyKey = "checkout-" + UUID.randomUUID();

        MvcResult first = mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .header("Idempotency-Key", idempotencyKey)
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andReturn();

        MvcResult second = mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .header("Idempotency-Key", idempotencyKey)
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(extractJsonValue(second.getResponse().getContentAsString(), "orderNumber"))
                .isEqualTo(extractJsonValue(first.getResponse().getContentAsString(), "orderNumber"));
        assertThat(extractJsonValue(second.getResponse().getContentAsString(), "orderKey"))
                .isEqualTo(extractJsonValue(first.getResponse().getContentAsString(), "orderKey"));
        assertThat(orderRepo.count()).isEqualTo(ordersBefore + 1);
        ProductEntity refreshed = productRepo.findById(product.getId()).orElseThrow();
        assertThat(refreshed.getStockQuantity()).isEqualTo(3);
    }

    @Test
    void checkout_sameIdempotencyKey_withDifferentPayload_returns409() throws Exception {
        ProductEntity product = createTrackedProduct("Idempotent Checkout Conflict", 1800000, 4);
        GuestSession session = newGuestSession();
        addProductToGuestCart(session, product.getId(), 1);
        String idempotencyKey = "checkout-conflict-" + UUID.randomUUID();

        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .header("Idempotency-Key", idempotencyKey)
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"BACS\",\"billingAddress\":" + VALID_BILLING + "}")
                        .header("Idempotency-Key", idempotencyKey)
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    @Test
    void quickBuy_sameIdempotencyKey_returnsExistingOrder_andDoesNotDecrementStockTwice() throws Exception {
        ProductEntity product = createTrackedProduct("Idempotent Quick Buy Product", 3200000, 6);
        GuestSession session = newGuestSession();
        long ordersBefore = orderRepo.count();
        String payload = "{\"productId\":\"" + product.getId() + "\",\"quantity\":2," +
                "\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}";
        String idempotencyKey = "quick-buy-" + UUID.randomUUID();

        MvcResult first = mockMvc.perform(post("/api/v1/orders/quick-buy")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .header("Idempotency-Key", idempotencyKey)
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andReturn();

        MvcResult second = mockMvc.perform(post("/api/v1/orders/quick-buy")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .header("Idempotency-Key", idempotencyKey)
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(extractJsonValue(second.getResponse().getContentAsString(), "orderNumber"))
                .isEqualTo(extractJsonValue(first.getResponse().getContentAsString(), "orderNumber"));
        assertThat(extractJsonValue(second.getResponse().getContentAsString(), "orderKey"))
                .isEqualTo(extractJsonValue(first.getResponse().getContentAsString(), "orderKey"));
        assertThat(orderRepo.count()).isEqualTo(ordersBefore + 1);
        ProductEntity refreshed = productRepo.findById(product.getId()).orElseThrow();
        assertThat(refreshed.getStockQuantity()).isEqualTo(4);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /** Create a new guest session (GET /api/v1/cart) and capture cookies. */
    private GuestSession newGuestSession() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = result.getResponse().getCookies();
        String csrf = getCookieValue(result.getResponse(), "bb_csrf");
        return new GuestSession(cookies, csrf);
    }

    /** Create guest session and add one item with given retail price and qty=1. */
    private GuestSession newGuestSessionWithItem(int retailPrice) throws Exception {
        return newGuestSessionWithItem(retailPrice, 1);
    }

    /** Create guest session and add one item with given retail price and qty. */
    private GuestSession newGuestSessionWithItem(int retailPrice, int qty) throws Exception {
        ProductEntity product = createTestProduct("Checkout Product " + retailPrice, retailPrice, null, PublishStatus.PUBLISHED);
        GuestSession session = newGuestSession();
        addProductToGuestCart(session, product.getId(), qty);
        return session;
    }

    /** Register + login a customer and add one item to their cart. */
    private AuthSession loginAndAddItem(String email, int retailPrice) throws Exception {
        mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"pass1234\"}"))
                .andExpect(status().isOk());
        MvcResult loginResult = mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"pass1234\"}"))
                .andExpect(status().isOk())
                .andReturn();
        Cookie[] cookies = loginResult.getResponse().getCookies();
        String csrf = getCookieValue(loginResult.getResponse(), "bb_csrf");

        ProductEntity product = createTestProduct("Auth Product " + retailPrice, retailPrice, null, PublishStatus.PUBLISHED);
        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk());

        return new AuthSession(cookies, csrf);
    }

    private ProductEntity createTestProduct(
            String name, int retailPrice, Integer salePrice, PublishStatus status
    ) {
        Instant now = Instant.now();
        ProductEntity product = new ProductEntity();
        product.setId(UUID.randomUUID().toString());
        product.setSlug("chk-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        product.setName(name);
        product.setRetailPrice(java.math.BigDecimal.valueOf(retailPrice));
        product.setSalePrice(salePrice == null ? null : java.math.BigDecimal.valueOf(salePrice));
        product.setCurrency("VND");
        product.setPublishStatus(status);
        product.setStockState(ProductStockState.IN_STOCK);
        product.setCreatedAt(now);
        product.setUpdatedAt(now);
        CategoryEntity cat = categoryRepo.findById(testCategoryId)
                .orElseThrow(() -> new IllegalStateException("Test category not found"));
        product.setCategory(cat);
        return productRepo.save(product);
    }

    private ProductEntity createTrackedProduct(String name, int retailPrice, int stockQuantity) {
        ProductEntity product = createTestProduct(name, retailPrice, null, PublishStatus.PUBLISHED);
        product.setManageStock(true);
        product.setStockQuantity(stockQuantity);
        product.setForceOutOfStock(false);
        product.setStockState(ProductStockState.IN_STOCK);
        product.setUpdatedAt(Instant.now());
        return productRepo.save(product);
    }

    private void addProductToGuestCart(GuestSession session, String productId, int qty) throws Exception {
        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + productId + "\",\"quantity\":" + qty + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk());
    }

    private String getCookieValue(MockHttpServletResponse response, String name) {
        Cookie[] cookies = response.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return c.getValue();
        }
        return null;
    }

    private String getCookieValue(GuestSession session, String name) {
        if (session.cookies == null) return null;
        for (Cookie c : session.cookies) {
            if (name.equals(c.getName())) return c.getValue();
        }
        return null;
    }

    /** Extract a string value from JSON by key — simple, no library needed for single values. */
    private String extractJsonValue(String json, String key) {
        String marker = "\"" + key + "\":\"";
        int start = json.indexOf(marker);
        if (start < 0) return null;
        start += marker.length();
        int end = json.indexOf("\"", start);
        return json.substring(start, end);
    }

    // ── value types ───────────────────────────────────────────────────────────

    private record GuestSession(Cookie[] cookies, String csrf) {}
    private record AuthSession(Cookie[] cookies, String csrf) {}
}
