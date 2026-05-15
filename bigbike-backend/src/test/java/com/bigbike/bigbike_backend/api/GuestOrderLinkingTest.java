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
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEmailVerificationTokenEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerEmailVerificationTokenJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.service.auth.JwtService;
import com.bigbike.bigbike_backend.service.customer.GuestOrderLinkingService;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class GuestOrderLinkingTest {

    private static final String GUEST_BILLING_TEMPLATE =
            "{\"fullName\":\"Guest\",\"phone\":\"0909000001\",\"email\":\"%s\"," +
            "\"addressLine1\":\"1 Test Rd\",\"province\":\"HCM\",\"country\":\"VN\"}";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired CustomerJpaRepository customerRepo;
    @Autowired CustomerEmailVerificationTokenJpaRepository tokenRepo;
    @Autowired OrderJpaRepository orderRepo;
    @Autowired ProductJpaRepository productRepo;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired GuestOrderLinkingService linkingService;

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
        testCategoryId = "cat-link-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        CategoryEntity cat = new CategoryEntity();
        cat.setId(testCategoryId);
        cat.setSlug("guest-link-cat-" + testCategoryId);
        cat.setName("Guest Link Test Category");
        cat.setVisible(true);
        cat.setCreatedAt(Instant.now());
        cat.setUpdatedAt(Instant.now());
        categoryRepo.save(cat);
    }

    // ── TC1: unverified customer — no linking on login ─────────────────────────

    @Test
    void unverifiedCustomer_login_doesNotLinkGuestOrders() throws Exception {
        String email = "link-unverified-" + UUID.randomUUID() + "@bigbike.vn";

        // Place guest order with this email
        String guestOrderNumber = placeGuestOrderForEmail(email);

        // Register and login (email NOT verified)
        Cookie[] cookies = registerAndLogin(email);

        // Customer's order list must NOT show the guest order
        String body = mockMvc.perform(get("/api/v1/customer/orders").cookie(cookies))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain(guestOrderNumber);

        // Order still unlinked in DB
        OrderEntity order = orderRepo.findByOrderNumber(guestOrderNumber).orElseThrow();
        assertThat(order.getCustomerId()).isNull();
    }

    // ── TC2: verify email → order gets linked ──────────────────────────────────

    @Test
    void verifyEmail_linksMatchingGuestOrders() throws Exception {
        String email = "link-verify-" + UUID.randomUUID() + "@bigbike.vn";

        // Place guest order
        String guestOrderNumber = placeGuestOrderForEmail(email);

        // Register
        registerCustomer(email);
        CustomerEntity customer = customerRepo.findByEmail(email).orElseThrow();

        // Call verify endpoint with a fresh token
        String rawToken = issueVerificationToken(customer);
        mockMvc.perform(post("/api/v1/customer/auth/verify-email")
                        .param("token", rawToken))
                .andExpect(status().isOk());

        // Order must now be linked
        OrderEntity order = orderRepo.findByOrderNumber(guestOrderNumber).orElseThrow();
        assertThat(order.getCustomerId()).isEqualTo(customer.getId());

        // Order appears in customer list
        Cookie[] cookies = loginCookies(email);
        String body = mockMvc.perform(get("/api/v1/customer/orders").cookie(cookies))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(body).contains(guestOrderNumber);
    }

    // ── TC3: already-verified customer logs in → new guest order gets linked ───

    @Test
    void alreadyVerified_login_linksNewGuestOrders() throws Exception {
        String email = "link-late-guest-" + UUID.randomUUID() + "@bigbike.vn";

        // Register and verify
        registerCustomer(email);
        CustomerEntity customer = customerRepo.findByEmail(email).orElseThrow();
        markEmailVerified(customer);

        // Place a guest order AFTER verification (simulates guest order created later)
        String guestOrderNumber = placeGuestOrderForEmail(email);

        // Login — linking must happen post-login
        Cookie[] cookies = loginCookies(email);

        // Order must now be linked
        OrderEntity order = orderRepo.findByOrderNumber(guestOrderNumber).orElseThrow();
        assertThat(order.getCustomerId()).isEqualTo(customer.getId());

        // Visible in order list
        String body = mockMvc.perform(get("/api/v1/customer/orders").cookie(cookies))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(body).contains(guestOrderNumber);
    }

    // ── TC4: different email → not linked ──────────────────────────────────────

    @Test
    void verifyEmail_doesNotLinkOrdersWithDifferentEmail() throws Exception {
        String emailA = "link-diff-a-" + UUID.randomUUID() + "@bigbike.vn";
        String emailB = "link-diff-b-" + UUID.randomUUID() + "@bigbike.vn";

        // Guest order for emailB
        String guestOrderNumber = placeGuestOrderForEmail(emailB);

        // Register and verify emailA
        registerCustomer(emailA);
        CustomerEntity customerA = customerRepo.findByEmail(emailA).orElseThrow();
        String rawToken = issueVerificationToken(customerA);
        mockMvc.perform(post("/api/v1/customer/auth/verify-email")
                        .param("token", rawToken))
                .andExpect(status().isOk());

        // Order with emailB must not be claimed by customerA
        OrderEntity order = orderRepo.findByOrderNumber(guestOrderNumber).orElseThrow();
        assertThat(order.getCustomerId()).isNull();
    }

    // ── TC5: already-owned order not overwritten ───────────────────────────────

    @Test
    void linkingDoesNotOverwriteExistingOwner() throws Exception {
        String email = "link-owned-" + UUID.randomUUID() + "@bigbike.vn";

        // Another customer owns this order
        CustomerEntity otherCustomer = createVerifiedCustomer("other-" + UUID.randomUUID() + "@bigbike.vn");
        OrderEntity ownedOrder = createGuestOrderRow(email, otherCustomer.getId());

        // Register and verify customer with same email
        registerCustomer(email);
        CustomerEntity customer = customerRepo.findByEmail(email).orElseThrow();
        String rawToken = issueVerificationToken(customer);
        mockMvc.perform(post("/api/v1/customer/auth/verify-email")
                        .param("token", rawToken))
                .andExpect(status().isOk());

        // Order owner must remain otherCustomer
        OrderEntity reloaded = orderRepo.findById(ownedOrder.getId()).orElseThrow();
        assertThat(reloaded.getCustomerId()).isEqualTo(otherCustomer.getId());
    }

    // ── TC6: case-insensitive email match ──────────────────────────────────────

    @Test
    void verifyEmail_linksCaseInsensitiveEmailMatch() throws Exception {
        // Guest order placed with uppercase email
        String upperEmail = "Link-Case-" + UUID.randomUUID() + "@BigBike.VN";
        String lowerEmail = upperEmail.toLowerCase();

        String guestOrderNumber = placeGuestOrderForEmail(upperEmail);

        // Register with lowercase (auth normalizes to lowercase)
        registerCustomer(lowerEmail);
        CustomerEntity customer = customerRepo.findByEmail(lowerEmail).orElseThrow();
        String rawToken = issueVerificationToken(customer);
        mockMvc.perform(post("/api/v1/customer/auth/verify-email")
                        .param("token", rawToken))
                .andExpect(status().isOk());

        // Order must be linked despite original email having mixed case
        OrderEntity order = orderRepo.findByOrderNumber(guestOrderNumber).orElseThrow();
        assertThat(order.getCustomerId()).isEqualTo(customer.getId());
    }

    // ── TC7: idempotency — running linking twice is safe ───────────────────────

    @Test
    void linkingIsIdempotent() throws Exception {
        String email = "link-idem-" + UUID.randomUUID() + "@bigbike.vn";
        placeGuestOrderForEmail(email);

        registerCustomer(email);
        CustomerEntity customer = customerRepo.findByEmail(email).orElseThrow();
        markEmailVerified(customer);

        // Run linking twice
        int firstRun = linkingService.linkVerifiedEmailOrders(customer.getId());
        int secondRun = linkingService.linkVerifiedEmailOrders(customer.getId());

        assertThat(firstRun).isGreaterThanOrEqualTo(1);
        assertThat(secondRun).isEqualTo(0); // Already linked — nothing to update
    }

    // ── TC8: guest lookup still works after order is linked ───────────────────

    @Test
    void guestLookup_stillWorksAfterOrderLinked() throws Exception {
        String email = "link-lookup-" + UUID.randomUUID() + "@bigbike.vn";
        GuestOrderRef guest = placeGuestOrderAndReturnRef(email);

        // Register and verify → links order
        registerCustomer(email);
        CustomerEntity customer = customerRepo.findByEmail(email).orElseThrow();
        String rawToken = issueVerificationToken(customer);
        mockMvc.perform(post("/api/v1/customer/auth/verify-email")
                        .param("token", rawToken))
                .andExpect(status().isOk());

        // Guest lookup by orderNumber + orderKey must still return 200
        mockMvc.perform(get("/api/v1/orders/lookup")
                        .param("orderNumber", guest.orderNumber())
                        .param("orderKey", guest.orderKey()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.orderNumber").value(guest.orderNumber()));
    }

    // ── TC9: customer list isolation still correct ────────────────────────────

    @Test
    void customerOrderList_showsOwnOrdersOnly_afterLinking() throws Exception {
        String emailA = "link-iso-a-" + UUID.randomUUID() + "@bigbike.vn";
        String emailB = "link-iso-b-" + UUID.randomUUID() + "@bigbike.vn";

        String orderForA = placeGuestOrderForEmail(emailA);
        String orderForB = placeGuestOrderForEmail(emailB);

        // Verify A → links orderForA
        registerCustomer(emailA);
        CustomerEntity customerA = customerRepo.findByEmail(emailA).orElseThrow();
        String tokenA = issueVerificationToken(customerA);
        mockMvc.perform(post("/api/v1/customer/auth/verify-email")
                        .param("token", tokenA))
                .andExpect(status().isOk());

        Cookie[] cookiesA = loginCookies(emailA);
        String bodyA = mockMvc.perform(get("/api/v1/customer/orders").cookie(cookiesA))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(bodyA).contains(orderForA);
        assertThat(bodyA).doesNotContain(orderForB);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void registerCustomer(String email) throws Exception {
        mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"pass1234\"}"))
                .andExpect(status().isOk());
    }

    private Cookie[] registerAndLogin(String email) throws Exception {
        registerCustomer(email);
        return loginCookies(email);
    }

    private Cookie[] loginCookies(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"pass1234\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return result.getResponse().getCookies();
    }

    private String placeGuestOrderForEmail(String email) throws Exception {
        GuestOrderRef ref = placeGuestOrderAndReturnRef(email);
        return ref.orderNumber();
    }

    private GuestOrderRef placeGuestOrderAndReturnRef(String email) throws Exception {
        // Get guest cart session
        MvcResult cartResult = mockMvc.perform(get("/api/v1/cart")).andReturn();
        Cookie[] guestCookies = cartResult.getResponse().getCookies();
        String csrf = getCookieValue(cartResult.getResponse(), "bb_csrf");

        // Add a product to cart
        ProductEntity product = createTestProduct("Link Test Product " + UUID.randomUUID(), 1_000_000);
        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"quantity\":1}")
                        .cookie(guestCookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk());

        // Checkout with guest email
        String billing = String.format(GUEST_BILLING_TEMPLATE, email);
        MvcResult result = mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + billing + "}")
                        .cookie(guestCookies).header("X-CSRF-Token", csrf))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        return new GuestOrderRef(extractJsonValue(body, "orderNumber"), extractJsonValue(body, "orderKey"));
    }

    /** Directly inserts a verification token and returns the raw (unhashed) token string. */
    private String issueVerificationToken(CustomerEntity customer) {
        String rawToken = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        CustomerEmailVerificationTokenEntity token = new CustomerEmailVerificationTokenEntity();
        token.setCustomerId(customer.getId());
        token.setTokenHash(sha256Hex(rawToken));
        token.setExpiresAt(Instant.now().plus(24, ChronoUnit.HOURS));
        token.setCreatedAt(Instant.now());
        tokenRepo.save(token);
        return rawToken;
    }

    /** Directly set emailVerifiedAt in DB — simulates a previously-verified account. */
    private void markEmailVerified(CustomerEntity customer) {
        customer.setEmailVerifiedAt(Instant.now());
        customer.setUpdatedAt(Instant.now());
        customerRepo.save(customer);
    }

    /** Create a verified customer directly in DB (no HTTP call needed). */
    private CustomerEntity createVerifiedCustomer(String email) {
        Instant now = Instant.now();
        CustomerEntity c = new CustomerEntity();
        c.setEmail(email.toLowerCase());
        c.setPasswordHash("dummy");
        c.setStatus("ACTIVE");
        c.setSynthetic(false);
        c.setEmailVerifiedAt(now);
        c.setCreatedAt(now);
        c.setUpdatedAt(now);
        return customerRepo.save(c);
    }

    /** Insert a guest order row directly, optionally pre-assigned to an owner. */
    private OrderEntity createGuestOrderRow(String customerEmail, UUID ownerId) {
        Instant now = Instant.now();
        OrderEntity o = new OrderEntity();
        o.setOrderNumber("LINK-TEST-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase());
        o.setOrderKey(UUID.randomUUID().toString());
        o.setCustomerEmail(customerEmail.toLowerCase());
        o.setCustomerId(ownerId);
        o.setStatus("PROCESSING");
        o.setPaymentStatus("UNPAID");
        o.setSubtotalAmount(BigDecimal.valueOf(500_000));
        o.setTotalAmount(BigDecimal.valueOf(500_000));
        o.setChannel("WEB");
        o.setFulfillmentType("DELIVERY");
        o.setCurrency("VND");
        o.setPlacedAt(now);
        o.setCreatedAt(now);
        o.setUpdatedAt(now);
        return orderRepo.save(o);
    }

    private ProductEntity createTestProduct(String name, int price) {
        Instant now = Instant.now();
        ProductEntity p = new ProductEntity();
        p.setId(UUID.randomUUID().toString());
        p.setSlug("link-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        p.setName(name);
        p.setRetailPrice(BigDecimal.valueOf(price));
        p.setCurrency("VND");
        p.setPublishStatus(PublishStatus.PUBLISHED);
        p.setStockState(ProductStockState.IN_STOCK);
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        p.setCategory(categoryRepo.findById(testCategoryId)
                .orElseThrow(() -> new IllegalStateException("Test category not found")));
        return productRepo.save(p);
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

    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private record GuestOrderRef(String orderNumber, String orderKey) {}
}
