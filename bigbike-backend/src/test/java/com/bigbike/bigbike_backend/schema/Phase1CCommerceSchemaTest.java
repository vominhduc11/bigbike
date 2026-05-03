package com.bigbike.bigbike_backend.schema;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAddressEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAppliedCouponEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderFeeItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderNoteEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderShippingItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEventEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderAppliedCouponJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderFeeItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderNoteJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderShippingItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentEventJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
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
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class Phase1CCommerceSchemaTest {

    @Autowired CartJpaRepository cartRepo;
    @Autowired CartItemJpaRepository cartItemRepo;
    @Autowired OrderJpaRepository orderRepo;
    @Autowired OrderLineItemJpaRepository lineItemRepo;
    @Autowired OrderShippingItemJpaRepository shippingItemRepo;
    @Autowired OrderFeeItemJpaRepository feeItemRepo;
    @Autowired OrderAppliedCouponJpaRepository appliedCouponRepo;
    @Autowired OrderAddressJpaRepository addressRepo;
    @Autowired OrderNoteJpaRepository noteRepo;
    @Autowired PaymentJpaRepository paymentRepo;
    @Autowired PaymentEventJpaRepository paymentEventRepo;
    @Autowired WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;

    @BeforeEach
    void setupMvc() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private CartEntity savedCart(String sessionId) {
        CartEntity c = new CartEntity();
        c.setSessionId(sessionId);
        c.setStatus("ACTIVE");
        c.setCreatedAt(Instant.now());
        c.setUpdatedAt(Instant.now());
        return cartRepo.save(c);
    }

    private OrderEntity savedOrder() {
        OrderEntity o = new OrderEntity();
        o.setOrderNumber("ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        o.setOrderKey("wc_order_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        o.setStatus("PENDING");
        o.setPaymentStatus("UNPAID");
        o.setCreatedAt(Instant.now());
        o.setUpdatedAt(Instant.now());
        return orderRepo.save(o);
    }

    // ── cart tests ────────────────────────────────────────────────────────────

    @Test
    void cart_saveAndFindBySessionId() {
        String sid = "sess-" + UUID.randomUUID();
        CartEntity cart = savedCart(sid);

        assertThat(cart.getId()).isNotNull();
        Optional<CartEntity> found = cartRepo.findBySessionId(sid);
        assertThat(found).isPresent();
        assertThat(found.get().getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void cartItem_saveAndFindByCartId() {
        CartEntity cart = savedCart("sess-item-" + UUID.randomUUID());

        CartItemEntity item = new CartItemEntity();
        item.setCart(cart);
        item.setProductName("Mũ bảo hiểm LS2 FF900");
        item.setSku("LS2-FF900-BLK-L");
        item.setQuantity(2);
        item.setUnitPrice(new BigDecimal("1500000.00"));
        item.setLineTotal(new BigDecimal("3000000.00"));
        item.setCreatedAt(Instant.now());
        item.setUpdatedAt(Instant.now());
        cartItemRepo.save(item);

        List<CartItemEntity> items = cartItemRepo.findByCartId(cart.getId());
        assertThat(items).hasSize(1);
        assertThat(items.get(0).getSku()).isEqualTo("LS2-FF900-BLK-L");
        assertThat(items.get(0).getQuantity()).isEqualTo(2);
    }

    // ── order tests ───────────────────────────────────────────────────────────

    @Test
    void order_saveAndFindByOrderNumber() {
        OrderEntity order = savedOrder();
        String number = order.getOrderNumber();

        Optional<OrderEntity> found = orderRepo.findByOrderNumber(number);
        assertThat(found).isPresent();
        assertThat(found.get().getStatus()).isEqualTo("PENDING");
    }

    @Test
    void order_saveAndFindByOrderKey() {
        OrderEntity order = savedOrder();
        String key = order.getOrderKey();

        Optional<OrderEntity> found = orderRepo.findByOrderKey(key);
        assertThat(found).isPresent();
        assertThat(found.get().getPaymentStatus()).isEqualTo("UNPAID");
    }

    @Test
    void orderLineItem_saveAndFindByOrderId() {
        OrderEntity order = savedOrder();

        OrderLineItemEntity item = new OrderLineItemEntity();
        item.setOrder(order);
        item.setProductName("Mũ bảo hiểm AGV K6 S");
        item.setSku("AGV-K6S-RED-M");
        item.setQuantity(1);
        item.setUnitPrice(new BigDecimal("4500000.00"));
        item.setLineTotal(new BigDecimal("4500000.00"));
        item.setCreatedAt(Instant.now());
        item.setUpdatedAt(Instant.now());
        lineItemRepo.save(item);

        List<OrderLineItemEntity> items = lineItemRepo.findByOrderId(order.getId());
        assertThat(items).hasSize(1);
        assertThat(items.get(0).getProductName()).isEqualTo("Mũ bảo hiểm AGV K6 S");
    }

    @Test
    void orderShippingItem_saveAndFindByOrderId() {
        OrderEntity order = savedOrder();

        OrderShippingItemEntity item = new OrderShippingItemEntity();
        item.setOrder(order);
        item.setMethodCode("cod");
        item.setMethodTitle("Thanh toán khi nhận hàng");
        item.setAmount(BigDecimal.ZERO);
        item.setCreatedAt(Instant.now());
        item.setUpdatedAt(Instant.now());
        shippingItemRepo.save(item);

        List<OrderShippingItemEntity> items = shippingItemRepo.findByOrderId(order.getId());
        assertThat(items).hasSize(1);
        assertThat(items.get(0).getMethodCode()).isEqualTo("cod");
    }

    @Test
    void orderFeeItem_saveAndFindByOrderId() {
        OrderEntity order = savedOrder();

        OrderFeeItemEntity item = new OrderFeeItemEntity();
        item.setOrder(order);
        item.setName("Phí xử lý đơn hàng");
        item.setAmount(new BigDecimal("5000.00"));
        item.setCreatedAt(Instant.now());
        item.setUpdatedAt(Instant.now());
        feeItemRepo.save(item);

        List<OrderFeeItemEntity> items = feeItemRepo.findByOrderId(order.getId());
        assertThat(items).hasSize(1);
        assertThat(items.get(0).getName()).isEqualTo("Phí xử lý đơn hàng");
    }

    @Test
    void orderAppliedCoupon_saveAndFindByCode() {
        OrderEntity order = savedOrder();
        String code = "SUMMER30-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase();

        OrderAppliedCouponEntity coupon = new OrderAppliedCouponEntity();
        coupon.setOrder(order);
        coupon.setCode(code);
        coupon.setDiscountAmount(new BigDecimal("90000.00"));
        coupon.setCreatedAt(Instant.now());
        appliedCouponRepo.save(coupon);

        List<OrderAppliedCouponEntity> found = appliedCouponRepo.findByCode(code);
        assertThat(found).hasSize(1);
        assertThat(found.get(0).getDiscountAmount()).isEqualByComparingTo(new BigDecimal("90000.00"));
    }

    @Test
    void orderAddress_saveAndFindByOrderIdAndType() {
        OrderEntity order = savedOrder();

        OrderAddressEntity addr = new OrderAddressEntity();
        addr.setOrder(order);
        addr.setType("BILLING");
        addr.setFullName("Nguyễn Văn An");
        addr.setPhone("0912345678");
        addr.setCountry("VN");
        addr.setProvince("Hồ Chí Minh");
        addr.setAddressLine1("123 Nguyễn Huệ, Quận 1");
        addr.setCreatedAt(Instant.now());
        addr.setUpdatedAt(Instant.now());
        addressRepo.save(addr);

        Optional<OrderAddressEntity> found = addressRepo.findByOrderIdAndType(order.getId(), "BILLING");
        assertThat(found).isPresent();
        assertThat(found.get().getPhone()).isEqualTo("0912345678");
    }

    @Test
    void orderNote_saveAndFindByOrderId() {
        OrderEntity order = savedOrder();

        OrderNoteEntity note = new OrderNoteEntity();
        note.setOrder(order);
        note.setAuthorType("admin");
        note.setNoteType("SYSTEM");
        note.setContent("Đơn hàng đã được tạo.");
        note.setCustomerVisible(false);
        note.setCreatedAt(Instant.now());
        noteRepo.save(note);

        List<OrderNoteEntity> notes = noteRepo.findByOrderIdOrderByCreatedAtAsc(order.getId());
        assertThat(notes).hasSize(1);
        assertThat(notes.get(0).getContent()).isEqualTo("Đơn hàng đã được tạo.");
    }

    @Test
    void payment_saveAndFindByOrderId() {
        OrderEntity order = savedOrder();

        PaymentEntity payment = new PaymentEntity();
        payment.setOrder(order);
        payment.setPaymentMethod("bacs");
        payment.setProvider("manual");
        payment.setStatus("PENDING");
        payment.setAmount(new BigDecimal("4500000.00"));
        payment.setCreatedAt(Instant.now());
        payment.setUpdatedAt(Instant.now());
        paymentRepo.save(payment);

        List<PaymentEntity> found = paymentRepo.findByOrderId(order.getId());
        assertThat(found).hasSize(1);
        assertThat(found.get(0).getPaymentMethod()).isEqualTo("bacs");
    }

    @Test
    void paymentEvent_saveAndFindByEventId() {
        String eventId = "evt_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);

        PaymentEventEntity event = new PaymentEventEntity();
        event.setProvider("manual");
        event.setEventType("payment.received");
        event.setEventId(eventId);
        event.setStatus("PENDING");
        event.setReceivedAt(Instant.now());
        paymentEventRepo.save(event);

        Optional<PaymentEventEntity> found = paymentEventRepo.findByEventId(eventId);
        assertThat(found).isPresent();
        assertThat(found.get().getProvider()).isEqualTo("manual");
    }

    // ── guest + snapshot design ───────────────────────────────────────────────

    @Test
    void guestOrder_customerIdNullable() {
        OrderEntity order = new OrderEntity();
        order.setOrderNumber("GUEST-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        order.setStatus("PENDING");
        order.setPaymentStatus("UNPAID");
        order.setCustomerPhone("0987654321");
        order.setCustomerEmail("guest@example.com");
        // customerId intentionally null — guest order
        order.setCreatedAt(Instant.now());
        order.setUpdatedAt(Instant.now());
        OrderEntity saved = orderRepo.save(order);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCustomerId()).isNull();
        assertThat(orderRepo.findByCustomerPhone("0987654321")).isNotEmpty();
    }

    @Test
    void orderSnapshot_doesNotRequireProductFk() {
        OrderEntity order = savedOrder();

        OrderLineItemEntity item = new OrderLineItemEntity();
        item.setOrder(order);
        item.setProductName("Mũ bảo hiểm [Discontinued Product]");
        item.setSku("DISC-001");
        item.setQuantity(1);
        item.setUnitPrice(new BigDecimal("1200000.00"));
        item.setLineTotal(new BigDecimal("1200000.00"));
        // productId and productVariantId intentionally null — snapshot
        item.setCreatedAt(Instant.now());
        item.setUpdatedAt(Instant.now());
        OrderLineItemEntity saved = lineItemRepo.save(item);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getProductId()).isNull();
        assertThat(saved.getProductName()).isEqualTo("Mũ bảo hiểm [Discontinued Product]");
    }

    // ── regression: Phase 1A security still intact ────────────────────────────

    @Test
    void securityRegression_adminStillProtected() throws Exception {
        mockMvc.perform(get("/api/v1/admin/products"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    void authRegression_loginStillWorks() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"bad\",\"password\":\"\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void publicReadRegression_stillPublic() throws Exception {
        mockMvc.perform(get("/api/v1/products").param("page", "1").param("size", "2"))
                .andExpect(status().isOk());
    }
}
