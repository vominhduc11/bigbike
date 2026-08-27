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
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatOrderAttributionJpaRepository;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
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

    private static final String VALID_BILLING = """
            {"fullName":"Nguyen Van A","phone":"0909123456","email":"buyer@example.com",
             "addressLine1":"123 Duong ABC","province":"HCM","ward":"Phuong Hoa Binh","country":"VN"}
            """;

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired CartJpaRepository cartRepo;
    @Autowired ProductJpaRepository productRepo;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired OrderJpaRepository orderRepo;
    @Autowired OrderLineItemJpaRepository lineItemRepo;
    @Autowired ProductVariantJpaRepository variantRepo;
    @Autowired StockMovementJpaRepository stockMovementRepo;
    @Autowired ChatConversationJpaRepository chatConversationRepo;
    @Autowired ChatMessageJpaRepository chatMessageRepo;
    @Autowired ChatOrderAttributionJpaRepository chatOrderAttributionRepo;

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

    // GET /checkout/options remains removed: COD and BANK_TRANSFER are the two fixed storefront
    // choices (PAY_RULE_001); the backend validates their enum through POST /checkout.

    @Test
    void checkoutOptions_endpointRemoved_isNoLongerPublic() throws Exception {
        // The permitAll matcher was removed with the endpoint, so the path falls into the
        // secure-by-default catch-all: anonymous requests get 401 instead of a response.
        mockMvc.perform(get("/api/v1/checkout/options"))
                .andExpect(status().isUnauthorized());
    }

    // ── CSRF protection (2) ───────────────────────────────────────────────────

    @Test
    void checkout_missingCsrf_returns403() throws Exception {
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("CSRF_INVALID"))
                .andExpect(jsonPath("$.meta.requestId").isNotEmpty())
                .andExpect(jsonPath("$.meta.timestamp").isNotEmpty());
    }

    // (quick-buy tests removed 2026-07-15 — endpoint deleted, reverses AUD-010.)

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

    // ── Two-tier VN address is mandatory (AUD-007) ────────────────────────────

    @Test
    void checkout_missingProvince_returns400() throws Exception {
        GuestSession session = newGuestSessionWithItem(5000000);
        String billing = """
                {"fullName":"Test","phone":"0909123456","email":"a@b.com",
                 "addressLine1":"123 Rd","ward":"Phuong 1"}
                """;
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + billing + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest());
    }

    @Test
    void checkout_missingWard_returns400() throws Exception {
        GuestSession session = newGuestSessionWithItem(5000000);
        String billing = """
                {"fullName":"Test","phone":"0909123456","email":"a@b.com",
                 "addressLine1":"123 Rd","province":"HCM"}
                """;
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + billing + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest());
    }

    @Test
    void checkout_customShippingWithBlankAddressLine_fallsBackToBilling() throws Exception {
        GuestSession session = newGuestSessionWithItem(2500000);
        // Blank strings must fall back to billing like nulls do — the order may not
        // persist an empty delivery address (AUD-007).
        String shipping = "{\"sameAsBilling\":false,\"fullName\":\"Nguoi Nhan\",\"addressLine1\":\"\"}";
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING +
                                 ",\"shippingAddress\":" + shipping + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"));
    }

    // ── Online orders carry no shipping fee (owner decision 2026-06-23) ────────

    @Test
    void checkout_createsOrder_withoutShippingMethod() throws Exception {
        GuestSession session = newGuestSessionWithItem(3000000);
        // Shipping method choice removed — checkout succeeds with no shippingMethodId and zero shipping.
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.orderNumber").isString())
                .andExpect(jsonPath("$.data.shippingAmount").value(0.00));
    }

    // ── Guest checkout happy paths (5) ────────────────────────────────────────

    @Test
    void checkout_guestCOD_createsOrder_status_PENDING() throws Exception {
        GuestSession session = newGuestSessionWithItem(4500000);
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.paymentMethod").value("COD"))
                .andExpect(jsonPath("$.data.orderNumber").isString())
                .andExpect(jsonPath("$.data.orderKey").isString());
    }

    @Test
    void checkout_guestBankTransfer_createsOrder_status_PENDING() throws Exception {
        GuestSession session = newGuestSessionWithItem(4500000);
        MvcResult result = mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"BANK_TRANSFER\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.paymentMethod").value("BANK_TRANSFER"))
                .andReturn();

        String orderNumber = extractJsonValue(result.getResponse().getContentAsString(), "orderNumber");
        assertThat(orderRepo.findByOrderNumber(orderNumber).orElseThrow().getPaymentMethod())
                .isEqualTo("BANK_TRANSFER");
    }

    @Test
    void checkout_explicitBACS_isRejected_asLegacyOnly() throws Exception {
        // BACS remains reserved for imported legacy orders; new checkout uses BANK_TRANSFER.
        GuestSession session = newGuestSessionWithItem(2000000);
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"BACS\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest());
    }

    @Test
    void checkout_omittedPaymentMethod_normalisesToCOD() throws Exception {
        // Every new online order is stored as COD (PAY_RULE_001).
        GuestSession session = newGuestSessionWithItem(2100000);
        MvcResult result = mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.paymentMethod").value("COD"))
                .andReturn();
        String orderNumber = extractJsonValue(result.getResponse().getContentAsString(), "orderNumber");
        assertThat(orderRepo.findByOrderNumber(orderNumber).orElseThrow().getPaymentMethod())
                .isEqualTo("COD");
    }

    @Test
    void checkout_guestOrder_startsAtPending() throws Exception {
        GuestSession session = newGuestSessionWithItem(1000000);
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"));
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
        Optional<CartEntity> cartBefore = cartRepo.findBySessionId(guestId).stream().findFirst();
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
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.orderNumber").isString());
    }

    @Test
    void checkout_authenticatedCustomer_orderInDB() throws Exception {
        String email = "chk-auth2-" + UUID.randomUUID() + "@bigbike.vn";
        AuthSession session = loginAndAddItem(email, 4000000);

        MvcResult result = mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
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
                .andExpect(jsonPath("$.data.status").value("PENDING"));
    }

    // (Quick-buy happy-path + validation tests removed 2026-07-15 — endpoint deleted,
    //  reverses AUD-010. The underlying rule AUD-002 stays covered by the cart/checkout
    //  tests below. AUD-003's forceOutOfStock hard-override was removed 2026-07-19 —
    //  variant availability alone now governs purchasability.)

    @Test
    void checkout_withUnpublishedProduct_returns409() throws Exception {
        // Product starts PUBLISHED so the cart API accepts it
        ProductEntity product = createTestProduct("Checkout Unpublished Product", 2600000, null, PublishStatus.PUBLISHED);
        GuestSession session = newGuestSession();
        addProductToGuestCart(session, product.getId().toString(), 1);

        // Simulate product being hidden after it was added to the cart
        product.setPublishStatus(PublishStatus.DRAFT);
        productRepo.save(product);

        // Checkout must reject because the product is no longer PUBLISHED
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isConflict());
    }

    // ── Cart-checkout availability for migrated wp-* catalog — V176 regression guard ──
    // Before V176: cart_items had no product_variant_pk and CheckoutService keyed on the UUID
    // product_id/product_variant_id, which are null for wp-* string-PK catalog, so wp-* cart
    // lines skipped validation entirely and two distinct wp-* products collapsed onto one line.
    // Inventory is boolean availability only since V261 (owner decision 2026-06-23):
    // checkout never decrements quantity and never writes stock movements.

    @Test
    void checkoutFromCart_wpVariant_createsOrder_withoutDecrementOrMovement() throws Exception {
        ProductEntity product = createWpProduct("WP Variant NonSerial", 6000000);
        ProductVariantEntity variant = createWpVariant(product, /*qoh*/ 5, 6000000);
        GuestSession session = newGuestSession();
        addVariantToGuestCart(session, product.getId(), variant.getId(), 2);

        MvcResult result = mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andReturn();
        UUID orderId = UUID.fromString(extractJsonValue(result.getResponse().getContentAsString(), "id"));

        assertThat(variantRepo.findById(variant.getId()).orElseThrow().getQuantityOnHand())
                .as("boolean availability model (V261): checkout must not decrement stock")
                .isEqualTo(5);

        List<StockMovementEntity> movements =
                stockMovementRepo.findByReferenceTypeAndReferenceId("ORDER", orderId);
        assertThat(movements).as("no stock movement is written on sale (V261)").isEmpty();

        // Order line must snapshot the variant string PK (V176) for symmetric later reads.
        assertThat(lineItemRepo.findByOrderId(orderId).get(0).getProductVariantPk())
                .isEqualTo(variant.getId());
    }

    @Test
    void cartAdd_twoDistinctWpProducts_doNotMerge() throws Exception {
        ProductEntity a = createWpProduct("WP Merge A", 1000000);
        ProductEntity b = createWpProduct("WP Merge B", 2000000);
        GuestSession session = newGuestSession();
        addProductToGuestCart(session, a.getId(), 1);
        addProductToGuestCart(session, b.getId(), 1);

        // Two distinct wp-* products (both UUID columns null) must remain two separate cart lines.
        mockMvc.perform(get("/api/v1/cart").cookie(session.cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(2));
    }

    @Test
    void cartAdd_sameWpVariantTwice_mergesToSingleLine() throws Exception {
        ProductEntity product = createWpProduct("WP Merge Same", 1200000);
        ProductVariantEntity variant = createWpVariant(product, /*qoh*/ 10, 1200000);
        GuestSession session = newGuestSession();
        addVariantToGuestCart(session, product.getId(), variant.getId(), 1);
        addVariantToGuestCart(session, product.getId(), variant.getId(), 2);

        // Same wp-* product+variant must dedup onto one line (qty 1+2=3), keyed on the varchar PK.
        mockMvc.perform(get("/api/v1/cart").cookie(session.cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].quantity").value(3));
    }

    @Test
    void checkoutFromCart_wpVariant_becameUnavailable_returns409() throws Exception {
        ProductEntity product = createWpProduct("WP Oversell Guard", 5500000);
        ProductVariantEntity variant = createWpVariant(product, /*qoh*/ 3, 5500000);
        GuestSession session = newGuestSession();
        addVariantToGuestCart(session, product.getId(), variant.getId(), 2);

        // Variant turned off after it was added (admin toggles Còn/Hết manually).
        variant.setAvailable(false);
        variantRepo.save(variant);

        // Before V176 the wp-* line was skipped by validation → order created anyway.
        // Now it must be revalidated by varchar PK and rejected.
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isConflict());
    }

    @Test
    void cartUpdateQuantity_wpVariant_unavailable_returns409() throws Exception {
        ProductEntity product = createWpProduct("WP Update Qty Guard", 1300000);
        ProductVariantEntity variant = createWpVariant(product, /*qoh*/ 2, 1300000);
        GuestSession session = newGuestSession();
        MvcResult add = mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"productVariantId\":\""
                                + variant.getId() + "\",\"quantity\":1}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andReturn();
        String itemId = extractItemId(add.getResponse().getContentAsString(), 0);

        // Variant turned off after add. Before V176 the wp-* line's UUID was null →
        // updateItemQuantity skipped re-validation; now it resolves by varchar PK and rejects.
        variant.setAvailable(false);
        variantRepo.save(variant);

        mockMvc.perform(patch("/api/v1/cart/items/" + itemId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantity\":5}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isConflict());
    }

    @Test
    void cart_wpProductUnpublishedAfterAdd_isMarkedUnavailable() throws Exception {
        ProductEntity product = createWpProduct("WP Unavailable Flag", 1500000);
        GuestSession session = newGuestSession();
        addProductToGuestCart(session, product.getId(), 1);

        // Hidden after it was added. findUnavailableItemIds must flag the wp-* line (resolved by
        // product_pk); before V176 it keyed on the null UUID column and left the item "available".
        product.setPublishStatus(PublishStatus.DRAFT);
        productRepo.save(product);

        mockMvc.perform(get("/api/v1/cart").cookie(session.cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].available").value(false));
    }

    @Test
    void mergeGuestCart_sameWpVariant_dedupsIntoCustomerLine() throws Exception {
        ProductEntity product = createWpProduct("WP Merge Login", 1700000);
        ProductVariantEntity variant = createWpVariant(product, /*qoh*/ 10, 1700000);

        // Customer registers, logs in, and adds the wp-* variant to their (customer) cart.
        String email = "wp-merge-" + UUID.randomUUID() + "@bigbike.vn";
        mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email
                                + "\",\"password\":\"pass1234\",\"privacyConsent\":true,\"privacyPolicyLocale\":\"vi\"}"))
                .andExpect(status().isOk());
        MvcResult login = mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"pass1234\"}"))
                .andExpect(status().isOk())
                .andReturn();
        Cookie[] authCookies = login.getResponse().getCookies();
        String authCsrf = getCookieValue(login.getResponse(), "bb_csrf");
        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId() + "\",\"productVariantId\":\""
                                + variant.getId() + "\",\"quantity\":1}")
                        .cookie(authCookies).header("X-CSRF-Token", authCsrf))
                .andExpect(status().isOk());

        // A guest session adds the SAME wp-* variant.
        GuestSession guest = newGuestSession();
        addVariantToGuestCart(guest, product.getId(), variant.getId(), 2);
        Cookie guestCookie = findCookie(guest.cookies, "bb_guest_id");

        // Authenticated cart resolve carrying the guest cookie → mergeGuestCart. The same variant must
        // dedup onto the existing customer line by varchar PK (qty 1+2=3), not appear as a second line.
        Cookie[] merged = new Cookie[authCookies.length + 1];
        System.arraycopy(authCookies, 0, merged, 0, authCookies.length);
        merged[authCookies.length] = guestCookie;
        mockMvc.perform(get("/api/v1/cart").cookie(merged))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].quantity").value(3));
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
        // Boolean availability model (V261): no decrement on sale, idempotent or not.
        assertThat(refreshed.getStockQuantity()).isEqualTo(5);
    }

    @Test
    void checkout_attributesOnlyVerifiedProductClick_andRetryDoesNotDuplicateRevenue() throws Exception {
        ProductEntity product = createTestProduct(
                "Assistant-attributed product", 1_590_000, null, PublishStatus.PUBLISHED);
        ChatConversationEntity conversation = new ChatConversationEntity();
        conversation.setLocale("vi");
        conversation = chatConversationRepo.save(conversation);
        ChatMessageEntity assistant = new ChatMessageEntity();
        assistant.setConversationId(conversation.getId());
        assistant.setRole("ASSISTANT");
        assistant.setContent("Sản phẩm đã được kiểm tra.");
        assistant.setSource("TOOL");
        assistant.setProductsJson("[{\"slug\":\"" + product.getSlug() + "\"}]");
        assistant.setActionMetadata("{}");
        assistant = chatMessageRepo.save(assistant);

        GuestSession session = newGuestSession();
        ProductEntity unshown = createTestProduct(
                "Product not shown by assistant", 990_000, null, PublishStatus.PUBLISHED);
        MvcResult interaction = mockMvc.perform(post("/api/v1/chat/interactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientEventId\":\"" + UUID.randomUUID()
                                + "\",\"conversationId\":\"" + conversation.getId()
                                + "\",\"assistantMessageId\":\"" + assistant.getId()
                                + "\",\"type\":\"PRODUCT_VIEWED\",\"productSlug\":\""
                                + product.getSlug() + "\"}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.attributionToken").isString())
                .andReturn();
        String attributionToken = extractJsonValue(
                interaction.getResponse().getContentAsString(), "attributionToken");

        // A mismatched proof never blocks the sale, but that line is not attributed.
        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + unshown.getId()
                                + "\",\"quantity\":1,\"assistantAttributionToken\":\""
                                + attributionToken + "\"}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + product.getId()
                                + "\",\"quantity\":2,\"assistantAttributionToken\":\""
                                + attributionToken + "\"}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk());

        String payload = "{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}";
        String idempotencyKey = "assistant-checkout-" + UUID.randomUUID();
        for (int attempt = 0; attempt < 2; attempt++) {
            mockMvc.perform(post("/api/v1/checkout")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload)
                            .header("Idempotency-Key", idempotencyKey)
                            .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                    .andExpect(status().isOk());
        }

        var attributions = chatOrderAttributionRepo.findByConversationId(conversation.getId());
        assertThat(attributions).hasSize(1);
        assertThat(attributions.get(0).getAttributedAmount())
                .isEqualByComparingTo(BigDecimal.valueOf(3_180_000));
        assertThat(attributions.get(0).getCurrency()).isEqualTo("VND");
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
                        .content("{\"paymentMethod\":\"COD\",\"customerNote\":\"đổi nội dung\"," +
                                 "\"billingAddress\":" + VALID_BILLING + "}")
                        .header("Idempotency-Key", idempotencyKey)
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    @Test
    void checkout_sameIdempotencyKey_differentGuestSessions_createDistinctOrders() throws Exception {
        String idempotencyKey = "checkout-scope-" + UUID.randomUUID();
        GuestSession sessionA = newGuestSessionWithItem(2600000);
        GuestSession sessionB = newGuestSessionWithItem(2700000);
        long ordersBefore = orderRepo.count();
        String payload = "{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}";

        MvcResult resultA = mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .header("Idempotency-Key", idempotencyKey)
                        .cookie(sessionA.cookies).header("X-CSRF-Token", sessionA.csrf))
                .andExpect(status().isOk())
                .andReturn();

        MvcResult resultB = mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .header("Idempotency-Key", idempotencyKey)
                        .cookie(sessionB.cookies).header("X-CSRF-Token", sessionB.csrf))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(extractJsonValue(resultA.getResponse().getContentAsString(), "orderNumber"))
                .isNotEqualTo(extractJsonValue(resultB.getResponse().getContentAsString(), "orderNumber"));
        assertThat(orderRepo.count()).isEqualTo(ordersBefore + 2);
    }

    @Test
    void checkout_orderHasZeroShipping_andTotalEqualsSubtotal() throws Exception {
        GuestSession session = newGuestSessionWithItem(3000000);

        MvcResult result = mockMvc.perform(post("/api/v1/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"COD\",\"billingAddress\":" + VALID_BILLING + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andReturn();

        String orderNumber = extractJsonValue(result.getResponse().getContentAsString(), "orderNumber");
        var order = orderRepo.findByOrderNumber(orderNumber).orElseThrow();
        assertThat(order.getShippingAmount()).isEqualByComparingTo(java.math.BigDecimal.ZERO);
        assertThat(order.getTotalAmount()).isEqualByComparingTo(order.getSubtotalAmount());
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
                        .content("{\"email\":\"" + email
                                + "\",\"password\":\"pass1234\",\"privacyConsent\":true,\"privacyPolicyLocale\":\"vi\"}"))
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
        product.setAvailable(true);
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

    private void addVariantToGuestCart(GuestSession session, String productId, String variantId, int qty) throws Exception {
        mockMvc.perform(post("/api/v1/cart/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + productId + "\",\"productVariantId\":\"" + variantId
                                + "\",\"quantity\":" + qty + "}")
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk());
    }

    /** Migrated WordPress catalog shape: varchar "wp-prod-*" PK, so the UUID column stays null. */
    private ProductEntity createWpProduct(String name, int retailPrice) {
        Instant now = Instant.now();
        ProductEntity product = new ProductEntity();
        product.setId("wp-prod-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
        product.setSlug("wp-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        product.setName(name);
        product.setRetailPrice(java.math.BigDecimal.valueOf(retailPrice));
        product.setCurrency("VND");
        product.setPublishStatus(PublishStatus.PUBLISHED);
        product.setStockState(ProductStockState.IN_STOCK);
        product.setAvailable(true);
        product.setCreatedAt(now);
        product.setUpdatedAt(now);
        product.setCategory(categoryRepo.findById(testCategoryId)
                .orElseThrow(() -> new IllegalStateException("Test category not found")));
        return productRepo.save(product);
    }

    /** Migrated variant shape: varchar "wp-var-*" PK, UUID column null. */
    private ProductVariantEntity createWpVariant(ProductEntity product, int qoh, int retailPrice) {
        ProductVariantEntity v = new ProductVariantEntity();
        v.setId("wp-var-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
        v.setProduct(product);
        v.setName("size: " + (38 + qoh));
        v.setSku("WP-VAR-" + v.getId().substring(7, 15));
        v.setRetailPrice(java.math.BigDecimal.valueOf(retailPrice));
        v.setCurrency("VND");
        v.setStockState(ProductStockState.IN_STOCK);
        v.setQuantityOnHand(qoh);
        v.setAvailable(true);
        v.setSortOrder(0);
        return variantRepo.save(v);
    }

    private String getCookieValue(MockHttpServletResponse response, String name) {
        Cookie[] cookies = response.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return c.getValue();
        }
        return null;
    }

    private Cookie findCookie(Cookie[] cookies, String name) {
        if (cookies != null) {
            for (Cookie c : cookies) {
                if (name.equals(c.getName())) return c;
            }
        }
        throw new IllegalStateException("Cookie not found: " + name);
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

    private String extractItemId(String json, int index) {
        final String itemsMarker = "\"items\":[";
        int itemsStart = json.indexOf(itemsMarker);
        if (itemsStart < 0) return null;
        String afterItems = json.substring(itemsStart + itemsMarker.length());
        final String idMarker = "\"id\":\"";
        int cursor = 0;
        for (int i = 0; i <= index; i++) {
            int found = afterItems.indexOf(idMarker, cursor);
            if (found < 0) return null;
            if (i == index) {
                int start = found + idMarker.length();
                int end = afterItems.indexOf("\"", start);
                return afterItems.substring(start, end);
            }
            cursor = found + idMarker.length();
        }
        return null;
    }

    // ── value types ───────────────────────────────────────────────────────────

    private record GuestSession(Cookie[] cookies, String csrf) {}
    private record AuthSession(Cookie[] cookies, String csrf) {}
}
