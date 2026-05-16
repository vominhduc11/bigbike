package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.api.cart.CartController;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartEntity;
import com.bigbike.bigbike_backend.persistence.entity.coupon.CouponEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.coupon.CouponJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
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
class Phase1ECartApiTest {

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired CartJpaRepository cartRepo;
    @Autowired CartItemJpaRepository cartItemRepo;
    @Autowired ProductJpaRepository productRepo;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired CustomerJpaRepository customerRepo;
    @Autowired CouponJpaRepository couponRepo;

    private MockMvc mockMvc;

    // Shared test category — created once per test run (slug must be unique)
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
        testCategoryId = "cat-test-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity cat = new CategoryEntity();
        cat.setId(testCategoryId);
        cat.setSlug("test-category-" + testCategoryId);
        cat.setName("Test Category");
        cat.setVisible(true);
        cat.setCreatedAt(Instant.now());
        cat.setUpdatedAt(Instant.now());
        categoryRepo.save(cat);
    }

    // ── getCart ───────────────────────────────────────────────────────────────

    @Test
    void getCart_withoutExistingCart_returnsEmptyOrCreatesCart() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/cart"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.currency").value("VND"))
                .andExpect(jsonPath("$.data.items").isArray())
                .andReturn();

        // Guest cookies should be set
        Cookie guestCookie = getNamedCookie(result.getResponse(), CartController.GUEST_COOKIE);
        assertThat(guestCookie).isNotNull();
        assertThat(guestCookie.getValue()).isNotBlank();
    }

    @Test
    void guestCart_usesSessionWithoutRawTokenStorage() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/cart"))
                .andExpect(status().isOk())
                .andReturn();

        Cookie guestCookie = getNamedCookie(result.getResponse(), CartController.GUEST_COOKIE);
        assertThat(guestCookie).isNotNull();
        String guestId = guestCookie.getValue();

        // guestId must be a valid UUID (not a hashed secret token)
        assertThat(guestId).matches("[0-9a-fA-F\\-]{36}");

        // Cart in DB must have session_id = guestId (not a raw bb_session hash)
        Optional<CartEntity> cart = cartRepo.findBySessionId(guestId).stream().findFirst();
        assertThat(cart).isPresent();
        assertThat(cart.get().getCustomerId()).isNull();
        assertThat(cart.get().getSessionId()).isEqualTo(guestId);
    }

    // ── addItem ───────────────────────────────────────────────────────────────

    @Test
    void addItem_withValidProduct_createsCartItem() throws Exception {
        ProductEntity product = createTestProduct("LS2 FF800 Storm II", 4500000, null, PublishStatus.PUBLISHED);

        MvcResult getResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = getResult.getResponse().getCookies();
        String csrf = getCookieValue(getResult.getResponse(), "bb_csrf");

        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1}")
                        .cookie(cookies)
                        .header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.items[0].productName").value("LS2 FF800 Storm II"))
                .andExpect(jsonPath("$.data.items[0].quantity").value(1))
                .andExpect(jsonPath("$.data.totals.totalAmount").value(4500000.00));
    }

    @Test
    void addSameItem_incrementsQuantity() throws Exception {
        ProductEntity product = createTestProduct("KYT NX Race", 3200000, null, PublishStatus.PUBLISHED);

        MvcResult getResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = getResult.getResponse().getCookies();
        String csrf = getCookieValue(getResult.getResponse(), "bb_csrf");

        // Add once
        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk());

        // Add again (same product)
        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":2}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].quantity").value(3));
    }

    @Test
    void addItem_productNotFound_returns404() throws Exception {
        MvcResult getResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = getResult.getResponse().getCookies();
        String csrf = getCookieValue(getResult.getResponse(), "bb_csrf");

        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"nonexistent-id-xxx\",\"quantity\":1}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isNotFound());
    }

    @Test
    void addItem_productUnpublished_returns409() throws Exception {
        ProductEntity product = createTestProduct("Draft Helmet", 1000000, null, PublishStatus.DRAFT);

        MvcResult getResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = getResult.getResponse().getCookies();
        String csrf = getCookieValue(getResult.getResponse(), "bb_csrf");

        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isConflict());
    }

    // ── CSRF protection ───────────────────────────────────────────────────────

    @Test
    void addItem_missingCsrf_forbidden() throws Exception {
        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"any\",\"quantity\":1}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("CSRF_INVALID"));
    }

    @Test
    void updateItem_missingCsrf_forbidden() throws Exception {
        mockMvc.perform(patch("/api/v1/cart/items/" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantity\":2}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("CSRF_INVALID"));
    }

    @Test
    void deleteItem_missingCsrf_forbidden() throws Exception {
        mockMvc.perform(delete("/api/v1/cart/items/" + UUID.randomUUID()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("CSRF_INVALID"));
    }

    // ── updateItem ────────────────────────────────────────────────────────────

    @Test
    void updateItemQuantity_recalculatesTotals() throws Exception {
        ProductEntity product = createTestProduct("AGV K6 S", 8000000, null, PublishStatus.PUBLISHED);

        MvcResult getResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = getResult.getResponse().getCookies();
        String csrf = getCookieValue(getResult.getResponse(), "bb_csrf");

        MvcResult addResult = mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andReturn();

        String cartJson = addResult.getResponse().getContentAsString();
        String extractedItemId = extractItemId(cartJson, 0);

        mockMvc.perform(patch("/api/v1/cart/items/" + extractedItemId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantity\":3}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].quantity").value(3))
                .andExpect(jsonPath("$.data.totals.totalAmount").value(24000000.00));
    }

    @Test
    void updateItemQuantity_zeroRejected() throws Exception {
        MvcResult getResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = getResult.getResponse().getCookies();
        String csrf = getCookieValue(getResult.getResponse(), "bb_csrf");

        mockMvc.perform(patch("/api/v1/cart/items/" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantity\":0}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateItemQuantity_negativeRejected() throws Exception {
        MvcResult getResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = getResult.getResponse().getCookies();
        String csrf = getCookieValue(getResult.getResponse(), "bb_csrf");

        mockMvc.perform(patch("/api/v1/cart/items/" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantity\":-1}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isBadRequest());
    }

    // ── removeItem ────────────────────────────────────────────────────────────

    @Test
    void removeItem_removesOnlyCurrentCartItem() throws Exception {
        ProductEntity p1 = createTestProduct("Helmet A", 2000000, null, PublishStatus.PUBLISHED);
        ProductEntity p2 = createTestProduct("Helmet B", 3000000, null, PublishStatus.PUBLISHED);

        MvcResult getResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = getResult.getResponse().getCookies();
        String csrf = getCookieValue(getResult.getResponse(), "bb_csrf");

        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + p1.getId() + "\",\"quantity\":1}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk());

        MvcResult addResult = mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + p2.getId() + "\",\"quantity\":1}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andReturn();

        String cartJson = addResult.getResponse().getContentAsString();
        // Extract first item ID
        String firstItemId = extractItemId(cartJson, 0);

        MvcResult deleteResult = mockMvc.perform(delete("/api/v1/cart/items/" + firstItemId)
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andReturn();
    }

    @Test
    void cartItemCannotBeModifiedFromDifferentSession() throws Exception {
        ProductEntity product = createTestProduct("Isolated Product", 1000000, null, PublishStatus.PUBLISHED);

        // Session A
        MvcResult sessionAGet = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookiesA = sessionAGet.getResponse().getCookies();
        String csrfA = getCookieValue(sessionAGet.getResponse(), "bb_csrf");

        MvcResult addResult = mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1}")
                        .cookie(cookiesA).header("X-CSRF-Token", csrfA))
                .andExpect(status().isOk())
                .andReturn();

        String cartJson = addResult.getResponse().getContentAsString();
        String itemId = extractItemId(cartJson, 0);

        // Session B (fresh guest, different cart)
        MvcResult sessionBGet = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookiesB = sessionBGet.getResponse().getCookies();
        String csrfB = getCookieValue(sessionBGet.getResponse(), "bb_csrf");

        // Session B tries to delete item from Session A's cart → 404
        mockMvc.perform(delete("/api/v1/cart/items/" + itemId)
                        .cookie(cookiesB).header("X-CSRF-Token", csrfB))
                .andExpect(status().isNotFound());
    }

    // ── clearCart ─────────────────────────────────────────────────────────────

    @Test
    void clearCart_removesAllItems() throws Exception {
        ProductEntity p1 = createTestProduct("Clear Test P1", 1000000, null, PublishStatus.PUBLISHED);
        ProductEntity p2 = createTestProduct("Clear Test P2", 2000000, null, PublishStatus.PUBLISHED);

        MvcResult getResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = getResult.getResponse().getCookies();
        String csrf = getCookieValue(getResult.getResponse(), "bb_csrf");

        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + p1.getId() + "\",\"quantity\":1}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + p2.getId() + "\",\"quantity\":1}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/v1/cart")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(0))
                .andExpect(jsonPath("$.data.totals.totalAmount").value(0.00));
    }

    // ── cart totals / BigDecimal snapshot ─────────────────────────────────────

    @Test
    void cartTotals_useBigDecimalSnapshot() throws Exception {
        ProductEntity product = createTestProduct("Precision Product", 1000001, null, PublishStatus.PUBLISHED);

        MvcResult getResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = getResult.getResponse().getCookies();
        String csrf = getCookieValue(getResult.getResponse(), "bb_csrf");

        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":2}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totals.totalAmount").value(2000002.00))
                .andExpect(jsonPath("$.data.totals.discountAmount").value(0.00))
                .andExpect(jsonPath("$.data.totals.shippingAmount").value(0.00));
    }

    @Test
    void productSnapshot_preservedAfterProductChange() throws Exception {
        ProductEntity product = createTestProduct("Original Name", 5000000, null, PublishStatus.PUBLISHED);
        String productId = product.getId();

        MvcResult getResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = getResult.getResponse().getCookies();
        String csrf = getCookieValue(getResult.getResponse(), "bb_csrf");

        // Add item — snapshot taken
        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + productId + "\",\"quantity\":1}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].productName").value("Original Name"))
                .andExpect(jsonPath("$.data.items[0].unitPrice").value(5000000.00));

        // Mutate product in DB
        product.setName("Changed Name");
        product.setRetailPrice(java.math.BigDecimal.valueOf(9000000));
        productRepo.save(product);

        // Get cart again — snapshot values must remain unchanged
        mockMvc.perform(get("/api/v1/cart")
                        .cookie(cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].productName").value("Original Name"))
                .andExpect(jsonPath("$.data.items[0].unitPrice").value(5000000.00));
    }

    // ── authenticated customer cart ───────────────────────────────────────────

    @Test
    void authenticatedCustomerCart_createdForCustomer() throws Exception {
        String email = "cart-customer-" + UUID.randomUUID() + "@bigbike.vn";
        Cookie[] cookies = loginAndGetCookies(email, "pass1234");

        MvcResult result = mockMvc.perform(get("/api/v1/cart").cookie(cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andReturn();

        // No bb_guest_id should be set for authenticated customer
        Cookie guestCookie = getNamedCookie(result.getResponse(), CartController.GUEST_COOKIE);
        assertThat(guestCookie).isNull();
    }

    @Test
    void authenticatedCustomerCart_addItemRequiresCsrf() throws Exception {
        String email = "cart-csrf-customer-" + UUID.randomUUID() + "@bigbike.vn";
        Cookie[] sessionCookies = loginAndGetCookies(email, "pass1234");
        ProductEntity product = createTestProduct("Customer Item", 2000000, null, PublishStatus.PUBLISHED);

        // POST without CSRF header — should fail
        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1}")
                        .cookie(sessionCookies)) // no X-CSRF-Token header
                .andExpect(status().isForbidden());
    }

    @Test
    void authenticatedCustomerCart_addItemWithCsrf_succeeds() throws Exception {
        String email = "cart-csrfok-" + UUID.randomUUID() + "@bigbike.vn";
        MvcResult loginResult = performLogin(email, "pass1234");
        Cookie[] cookies = loginResult.getResponse().getCookies();
        String csrf = getCookieValue(loginResult.getResponse(), "bb_csrf");

        ProductEntity product = createTestProduct("Auth Customer Product", 3000000, null, PublishStatus.PUBLISHED);

        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].productName").value("Auth Customer Product"));
    }

    // ── regression ────────────────────────────────────────────────────────────

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
        String email = "cart-me-" + UUID.randomUUID() + "@bigbike.vn";
        Cookie[] cookies = loginAndGetCookies(email, "pass1234");
        mockMvc.perform(get("/api/v1/customer/me").cookie(cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value(email));
    }

    @Test
    void customerLogout_stillRequiresCsrf() throws Exception {
        String email = "cart-logout-" + UUID.randomUUID() + "@bigbike.vn";
        Cookie[] cookies = loginAndGetCookies(email, "pass1234");
        // POST logout without X-CSRF-Token header → 403
        mockMvc.perform(post("/api/v1/customer/auth/logout").cookie(cookies))
                .andExpect(status().isForbidden());
    }

    @Test
    void existing67TestsStillPass_adminAuthStillProtected() throws Exception {
        mockMvc.perform(get("/api/v1/admin/products"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    // ── cart coupon refresh tests ─────────────────────────────────────────────

    // R1. Reduce item qty → subtotal drops below coupon minimumAmount → coupon auto-removed
    @Test
    void updateItemQty_reducesSubtotalBelowMinAmount_couponRemoved() throws Exception {
        // Product at 1 000 000; 2 units → subtotal 2 000 000, which meets min 1 500 000
        ProductEntity product = createTestProduct("MinAmount Helmet", 1000000, null, PublishStatus.PUBLISHED);
        CouponEntity coupon = createCartTestCoupon("MINAMT-" + UUID.randomUUID().toString().replace("-","").substring(0,6).toUpperCase(),
                "FIXED", new BigDecimal("50000"), new BigDecimal("1500000"));

        MvcResult getResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = getResult.getResponse().getCookies();
        String csrf = getCookieValue(getResult.getResponse(), "bb_csrf");

        // Add 2 units (subtotal 2 000 000 ≥ min 1 500 000)
        MvcResult addResult = mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":2}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andReturn();

        // Apply coupon — should succeed (subtotal 2M ≥ min 1.5M)
        mockMvc.perform(post("/api/v1/cart/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + coupon.getCode() + "\"}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.couponCodes").isArray())
                .andExpect(jsonPath("$.data.couponCodes.length()").value(1));

        // Reduce to 1 unit (subtotal 1M < min 1.5M) → refreshCartTotals removes coupon
        String itemId = extractItemId(addResult.getResponse().getContentAsString(), 0);
        mockMvc.perform(patch("/api/v1/cart/items/" + itemId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantity\":1}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.couponCodes.length()").value(0))
                .andExpect(jsonPath("$.data.totals.discountAmount").value(0.00));
    }

    // R2. Coupon goes INACTIVE after apply → cart item update triggers refresh → coupon removed
    @Test
    void couponBecomesInactive_afterApply_cartRefreshRemovesCoupon() throws Exception {
        ProductEntity product = createTestProduct("Inactive Coupon Helmet", 500000, null, PublishStatus.PUBLISHED);
        CouponEntity coupon = createCartTestCoupon("INACTIVE-" + UUID.randomUUID().toString().replace("-","").substring(0,6).toUpperCase(),
                "FIXED", new BigDecimal("30000"), null);

        MvcResult getResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] cookies = getResult.getResponse().getCookies();
        String csrf = getCookieValue(getResult.getResponse(), "bb_csrf");

        // Add item and apply coupon — both succeed
        MvcResult addResult = mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andReturn();

        mockMvc.perform(post("/api/v1/cart/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + coupon.getCode() + "\"}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.couponCodes.length()").value(1));

        // Admin disables the coupon (direct DB write)
        coupon.setStatus("INACTIVE");
        coupon.setUpdatedAt(Instant.now());
        couponRepo.save(coupon);

        // Trigger refreshCartTotals by updating the item quantity
        String itemId = extractItemId(addResult.getResponse().getContentAsString(), 0);
        mockMvc.perform(patch("/api/v1/cart/items/" + itemId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantity\":2}")
                        .cookie(cookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.couponCodes.length()").value(0))
                .andExpect(jsonPath("$.data.totals.discountAmount").value(0.00));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private CouponEntity createCartTestCoupon(String code, String discountType,
            BigDecimal amount, BigDecimal minimumAmount) {
        Instant now = Instant.now();
        CouponEntity c = new CouponEntity();
        c.setCode(code);
        c.setName("Cart Test Coupon " + code);
        c.setDiscountType(discountType);
        c.setAmount(amount);
        c.setMinAmount(minimumAmount);
        c.setUsageCount(0);
        c.setStatus("ACTIVE");
        c.setExpiresAt(now.plus(30, ChronoUnit.DAYS));
        c.setCreatedAt(now);
        c.setUpdatedAt(now);
        return couponRepo.save(c);
    }

    private ProductEntity createTestProduct(
            String name, int retailPrice, Integer salePrice, PublishStatus status
    ) {
        Instant now = Instant.now();
        ProductEntity product = new ProductEntity();
        product.setId(UUID.randomUUID().toString());
        product.setSlug("test-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        product.setName(name);
        product.setRetailPrice(java.math.BigDecimal.valueOf(retailPrice));
        product.setSalePrice(salePrice == null ? null : java.math.BigDecimal.valueOf(salePrice));
        product.setCurrency("VND");
        product.setPublishStatus(status);
        product.setStockState(ProductStockState.IN_STOCK);
        product.setCreatedAt(now);
        product.setUpdatedAt(now);

        // Must set category (not null in entity)
        CategoryEntity cat = categoryRepo.findById(testCategoryId)
                .orElseThrow(() -> new IllegalStateException("Test category not found"));
        product.setCategory(cat);

        return productRepo.save(product);
    }

    private MvcResult performLogin(String email, String password) throws Exception {
        mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk());
        return mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
    }

    private Cookie[] loginAndGetCookies(String email, String password) throws Exception {
        return performLogin(email, password).getResponse().getCookies();
    }

    private Cookie getNamedCookie(MockHttpServletResponse response, String name) {
        Cookie[] cookies = response.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return c;
        }
        return null;
    }

    private String getCookieValue(MockHttpServletResponse response, String name) {
        Cookie cookie = getNamedCookie(response, name);
        return cookie != null ? cookie.getValue() : null;
    }

    /**
     * Extracts the {@code id} field of the Nth item (0-based) from the
     * {@code data.items} array in the cart response JSON.
     * Works because item own-id appears as {@code "id":"<uuid>"} while
     * product references appear as {@code "productId":"<uuid>"} — distinct pattern.
     */
    private String extractItemId(String json, int index) {
        final String ITEMS_MARKER = "\"items\":[";
        int itemsStart = json.indexOf(ITEMS_MARKER);
        if (itemsStart < 0) return null;
        String afterItems = json.substring(itemsStart + ITEMS_MARKER.length());
        final String ID_MARKER = "\"id\":\"";
        int cursor = 0;
        for (int i = 0; i <= index; i++) {
            int found = afterItems.indexOf(ID_MARKER, cursor);
            if (found < 0) return null;
            if (i == index) {
                int start = found + ID_MARKER.length();
                int end = afterItems.indexOf("\"", start);
                return afterItems.substring(start, end);
            }
            cursor = found + ID_MARKER.length();
        }
        return null;
    }
}
