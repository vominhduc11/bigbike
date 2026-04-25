package com.bigbike.bigbike_backend.service.checkout;

import com.bigbike.bigbike_backend.api.checkout.dto.CheckoutAddressRequest;
import com.bigbike.bigbike_backend.api.checkout.dto.CheckoutOptionsResponse;
import com.bigbike.bigbike_backend.api.checkout.dto.CheckoutRequest;
import com.bigbike.bigbike_backend.api.checkout.dto.CheckoutShippingAddressRequest;
import com.bigbike.bigbike_backend.api.checkout.dto.OrderSummaryResponse;
import com.bigbike.bigbike_backend.api.checkout.dto.PaymentMethodOptionResponse;
import com.bigbike.bigbike_backend.api.checkout.dto.QuickBuyRequest;
import com.bigbike.bigbike_backend.api.checkout.dto.ShippingMethodOptionResponse;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAddressEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderNoteEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderShippingItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import com.bigbike.bigbike_backend.persistence.entity.shipping.ShippingMethodEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderNoteJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderShippingItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.shipping.ShippingMethodJpaRepository;
import com.bigbike.bigbike_backend.service.cart.CartCalculator;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CheckoutService {

    private static final Set<String> ALLOWED_PAYMENT_METHODS = Set.of("COD", "BACS");
    private static final String CART_STATUS_CONVERTED = "CONVERTED";
    private static final String ORDER_STATUS_PROCESSING = "PROCESSING";
    private static final String ORDER_STATUS_ON_HOLD = "ON_HOLD";
    private static final String PAYMENT_STATUS_UNPAID = "UNPAID";
    private static final String PAYMENT_RECORD_STATUS_PENDING = "PENDING";
    private static final String CURRENCY_VND = "VND";

    private final CartJpaRepository cartRepo;
    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final OrderAddressJpaRepository addressRepo;
    private final OrderShippingItemJpaRepository shippingItemRepo;
    private final OrderNoteJpaRepository noteRepo;
    private final PaymentJpaRepository paymentRepo;
    private final ShippingMethodJpaRepository shippingMethodRepo;
    private final ProductJpaRepository productRepo;
    private final ProductVariantJpaRepository variantRepo;
    private final OrderNumberGenerator orderNumberGenerator;
    private final OrderKeyGenerator orderKeyGenerator;
    private final CartCalculator cartCalculator;

    public CheckoutService(
            CartJpaRepository cartRepo,
            OrderJpaRepository orderRepo,
            OrderLineItemJpaRepository lineItemRepo,
            OrderAddressJpaRepository addressRepo,
            OrderShippingItemJpaRepository shippingItemRepo,
            OrderNoteJpaRepository noteRepo,
            PaymentJpaRepository paymentRepo,
            ShippingMethodJpaRepository shippingMethodRepo,
            ProductJpaRepository productRepo,
            ProductVariantJpaRepository variantRepo,
            OrderNumberGenerator orderNumberGenerator,
            OrderKeyGenerator orderKeyGenerator,
            CartCalculator cartCalculator
    ) {
        this.cartRepo = cartRepo;
        this.orderRepo = orderRepo;
        this.lineItemRepo = lineItemRepo;
        this.addressRepo = addressRepo;
        this.shippingItemRepo = shippingItemRepo;
        this.noteRepo = noteRepo;
        this.paymentRepo = paymentRepo;
        this.shippingMethodRepo = shippingMethodRepo;
        this.productRepo = productRepo;
        this.variantRepo = variantRepo;
        this.orderNumberGenerator = orderNumberGenerator;
        this.orderKeyGenerator = orderKeyGenerator;
        this.cartCalculator = cartCalculator;
    }

    // ── Checkout from cart ────────────────────────────────────────────────────

    @Transactional
    public OrderSummaryResponse checkoutFromCart(
            CartEntity cart,
            List<CartItemEntity> items,
            CheckoutRequest req,
            UUID customerId,
            String clientIp,
            String userAgent
    ) {
        if (items.isEmpty()) {
            throw ValidationException.fromField("cart", "EMPTY_CART", "Cart has no items.");
        }
        validateAddress(req.billingAddress());
        validatePaymentMethod(req.paymentMethod());

        ShippingMethodEntity shippingMethod = resolveShippingMethod(req.shippingMethodId());

        BigDecimal subtotal = items.stream()
                .map(CartItemEntity::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal shippingCost = resolveShippingCost(shippingMethod, subtotal);
        BigDecimal total = subtotal.add(shippingCost).setScale(2, RoundingMode.HALF_UP);

        // Build order
        Instant now = Instant.now();
        OrderEntity order = buildOrder(
                customerId,
                req.billingAddress().email(),
                req.billingAddress().phone(),
                req.customerNote(),
                req.paymentMethod(),
                subtotal,
                BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                shippingCost,
                total,
                "checkout",
                clientIp,
                userAgent,
                now
        );
        OrderEntity savedOrder = orderRepo.save(order);

        // Line items from cart
        for (CartItemEntity cartItem : items) {
            lineItemRepo.save(buildLineItemFromCart(savedOrder, cartItem, now));
        }

        // Addresses
        addressRepo.save(buildAddress(savedOrder, "BILLING", req.billingAddress(), now));
        CheckoutAddressRequest shippingAddr = resolveShippingAddress(req.billingAddress(), req.shippingAddress());
        addressRepo.save(buildAddress(savedOrder, "SHIPPING", shippingAddr, now));

        // Shipping item
        shippingItemRepo.save(buildShippingItem(savedOrder, shippingMethod, shippingCost, now));

        // Payment
        paymentRepo.save(buildPayment(savedOrder, req.paymentMethod(), total, now));

        // System note
        noteRepo.save(buildSystemNote(savedOrder,
                "Đơn hàng được tạo. Phương thức thanh toán: " + req.paymentMethod() +
                ". Phương thức vận chuyển: " + shippingMethod.getTitle() + ".", now));

        // Mark cart converted
        cart.setStatus(CART_STATUS_CONVERTED);
        cart.setUpdatedAt(now);
        cartRepo.save(cart);

        return toSummary(savedOrder, req.paymentMethod());
    }

    // ── Quick-buy ─────────────────────────────────────────────────────────────

    @Transactional
    public OrderSummaryResponse quickBuy(
            QuickBuyRequest req,
            UUID customerId,
            String clientIp,
            String userAgent
    ) {
        validateAddress(req.billingAddress());
        validatePaymentMethod(req.paymentMethod());

        ProductEntity product = productRepo.findById(req.productId())
                .orElseThrow(() -> new NotFoundException("Product not found: " + req.productId()));
        if (product.getPublishStatus() != PublishStatus.PUBLISHED) {
            throw new ConflictException("Product is not available.");
        }

        ProductVariantEntity variant = null;
        if (req.productVariantId() != null && !req.productVariantId().isBlank()) {
            variant = variantRepo.findByIdAndProductId(req.productVariantId(), product.getId())
                    .orElseThrow(() -> new NotFoundException("Variant not found: " + req.productVariantId()));
            if (!variant.isAvailable()) {
                throw new ConflictException("Product variant is not available.");
            }
        }

        BigDecimal unitPrice = resolveUnitPrice(product, variant);
        int qty = req.quantity();
        BigDecimal lineSubtotal = unitPrice.multiply(BigDecimal.valueOf(qty)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal lineDiscount = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        BigDecimal lineTotal = lineSubtotal.subtract(lineDiscount).setScale(2, RoundingMode.HALF_UP);

        ShippingMethodEntity shippingMethod = resolveShippingMethod(req.shippingMethodId());
        BigDecimal shippingCost = resolveShippingCost(shippingMethod, lineTotal);
        BigDecimal total = lineTotal.add(shippingCost).setScale(2, RoundingMode.HALF_UP);

        Instant now = Instant.now();
        OrderEntity order = buildOrder(
                customerId,
                req.billingAddress().email(),
                req.billingAddress().phone(),
                req.customerNote(),
                req.paymentMethod(),
                lineSubtotal,
                lineDiscount,
                shippingCost,
                total,
                "quick_buy",
                clientIp,
                userAgent,
                now
        );
        OrderEntity savedOrder = orderRepo.save(order);

        // Line item from product snapshot
        lineItemRepo.save(buildLineItemFromProduct(savedOrder, product, variant,
                unitPrice, qty, lineSubtotal, lineDiscount, lineTotal, now));

        // Addresses
        addressRepo.save(buildAddress(savedOrder, "BILLING", req.billingAddress(), now));
        addressRepo.save(buildAddress(savedOrder, "SHIPPING", req.billingAddress(), now));

        // Shipping item
        shippingItemRepo.save(buildShippingItem(savedOrder, shippingMethod, shippingCost, now));

        // Payment
        paymentRepo.save(buildPayment(savedOrder, req.paymentMethod(), total, now));

        // System note
        noteRepo.save(buildSystemNote(savedOrder,
                "Quick-buy đơn hàng được tạo. Phương thức thanh toán: " + req.paymentMethod() +
                ". Sản phẩm: " + product.getName() + " x" + qty + ".", now));

        return toSummary(savedOrder, req.paymentMethod());
    }

    // ── Checkout options ──────────────────────────────────────────────────────

    public CheckoutOptionsResponse getOptions() {
        List<PaymentMethodOptionResponse> paymentMethods = List.of(
                new PaymentMethodOptionResponse("COD", "Thanh toán khi nhận hàng"),
                new PaymentMethodOptionResponse("BACS", "Chuyển khoản ngân hàng")
        );
        List<ShippingMethodOptionResponse> shippingMethods = shippingMethodRepo
                .findByEnabledOrderBySortOrderAsc(true)
                .stream()
                .map(m -> new ShippingMethodOptionResponse(
                        m.getId(),
                        m.getMethodCode(),
                        m.getTitle(),
                        m.getCost() != null ? m.getCost() : BigDecimal.ZERO
                ))
                .toList();
        return new CheckoutOptionsResponse(paymentMethods, shippingMethods);
    }

    // ── Shipping cost helpers ─────────────────────────────────────────────────

    private BigDecimal resolveShippingCost(ShippingMethodEntity method, BigDecimal orderSubtotal) {
        BigDecimal threshold = method.getFreeShippingThreshold();
        if (threshold != null && orderSubtotal.compareTo(threshold) >= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return method.getCost() != null
                ? method.getCost().setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }

    // ── Validation helpers ────────────────────────────────────────────────────

    private void validateAddress(CheckoutAddressRequest addr) {
        if (addr.fullName() == null || addr.fullName().isBlank()) {
            throw ValidationException.fromField("billingAddress.fullName", "REQUIRED", "Full name is required.");
        }
        if (addr.phone() == null || !addr.phone().matches("\\d{10}")) {
            throw ValidationException.fromField("billingAddress.phone", "INVALID_PHONE",
                    "Phone must be 10 digits.");
        }
        if (addr.email() != null && !addr.email().isBlank() && !addr.email().contains("@")) {
            throw ValidationException.fromField("billingAddress.email", "INVALID_EMAIL",
                    "Email is invalid.");
        }
        if (addr.addressLine1() == null || addr.addressLine1().isBlank()) {
            throw ValidationException.fromField("billingAddress.addressLine1", "REQUIRED",
                    "Address line 1 is required.");
        }
    }

    private void validatePaymentMethod(String method) {
        if (!ALLOWED_PAYMENT_METHODS.contains(method)) {
            throw ValidationException.fromField("paymentMethod", "UNSUPPORTED",
                    "Payment method must be COD or BACS.");
        }
    }

    private ShippingMethodEntity resolveShippingMethod(String shippingMethodId) {
        if (shippingMethodId != null && !shippingMethodId.isBlank()) {
            UUID id;
            try {
                id = UUID.fromString(shippingMethodId);
            } catch (IllegalArgumentException e) {
                throw ValidationException.fromField("shippingMethodId", "INVALID",
                        "Shipping method ID is invalid.");
            }
            ShippingMethodEntity method = shippingMethodRepo.findById(id)
                    .orElseThrow(() -> ValidationException.fromField("shippingMethodId", "NOT_FOUND",
                            "Shipping method not found."));
            if (!method.isEnabled()) {
                throw ValidationException.fromField("shippingMethodId", "DISABLED",
                        "Shipping method is disabled.");
            }
            return method;
        }

        // Auto-select if exactly one enabled method
        List<ShippingMethodEntity> enabled = shippingMethodRepo.findByEnabledOrderBySortOrderAsc(true);
        if (enabled.size() == 1) {
            return enabled.get(0);
        }
        throw ValidationException.fromField("shippingMethodId", "REQUIRED",
                "Shipping method is required when multiple methods are available.");
    }

    private CheckoutAddressRequest resolveShippingAddress(
            CheckoutAddressRequest billing,
            CheckoutShippingAddressRequest shipping
    ) {
        if (shipping == null || Boolean.TRUE.equals(shipping.sameAsBilling())) {
            return billing;
        }
        return new CheckoutAddressRequest(
                shipping.fullName() != null ? shipping.fullName() : billing.fullName(),
                shipping.email() != null ? shipping.email() : billing.email(),
                shipping.phone() != null ? shipping.phone() : billing.phone(),
                shipping.country() != null ? shipping.country() : billing.country(),
                shipping.province() != null ? shipping.province() : billing.province(),
                shipping.district() != null ? shipping.district() : billing.district(),
                shipping.ward() != null ? shipping.ward() : billing.ward(),
                shipping.addressLine1() != null ? shipping.addressLine1() : billing.addressLine1(),
                shipping.addressLine2()
        );
    }

    // ── Build helpers ─────────────────────────────────────────────────────────

    private OrderEntity buildOrder(
            UUID customerId,
            String email,
            String phone,
            String customerNote,
            String paymentMethod,
            BigDecimal subtotal,
            BigDecimal discount,
            BigDecimal shipping,
            BigDecimal total,
            String source,
            String clientIp,
            String userAgent,
            Instant now
    ) {
        String orderStatus = "COD".equals(paymentMethod) ? ORDER_STATUS_PROCESSING : ORDER_STATUS_ON_HOLD;

        OrderEntity order = new OrderEntity();
        order.setOrderNumber(orderNumberGenerator.generate());
        order.setOrderKey(orderKeyGenerator.generate());
        order.setCustomerId(customerId);
        order.setStatus(orderStatus);
        order.setPaymentStatus(PAYMENT_STATUS_UNPAID);
        order.setCustomerEmail(email);
        order.setCustomerPhone(phone);
        order.setCustomerNote(customerNote);
        order.setCurrency(CURRENCY_VND);
        order.setSubtotalAmount(subtotal);
        order.setDiscountAmount(discount);
        order.setShippingAmount(shipping);
        order.setFeeAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        order.setTaxAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        order.setTotalAmount(total);
        order.setPaidAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        order.setSource(source);
        order.setIpAddress(clientIp);
        order.setUserAgent(userAgent);
        order.setPlacedAt(now);
        order.setCreatedAt(now);
        order.setUpdatedAt(now);
        return order;
    }

    private OrderLineItemEntity buildLineItemFromCart(
            OrderEntity order, CartItemEntity cartItem, Instant now
    ) {
        OrderLineItemEntity item = new OrderLineItemEntity();
        item.setOrder(order);
        item.setProductId(cartItem.getProductId());
        item.setProductVariantId(cartItem.getProductVariantId());
        item.setSku(cartItem.getSku());
        item.setProductName(cartItem.getProductName());
        item.setVariantName(cartItem.getVariantName());
        item.setQuantity(cartItem.getQuantity());
        item.setUnitPrice(cartItem.getUnitPrice());
        item.setRegularPrice(cartItem.getRegularPrice());
        item.setSalePrice(cartItem.getSalePrice());
        item.setLineSubtotal(cartItem.getLineSubtotal());
        item.setLineDiscount(cartItem.getLineDiscount());
        item.setLineTax(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        item.setLineTotal(cartItem.getLineTotal());
        item.setCreatedAt(now);
        item.setUpdatedAt(now);
        return item;
    }

    private OrderLineItemEntity buildLineItemFromProduct(
            OrderEntity order,
            ProductEntity product,
            ProductVariantEntity variant,
            BigDecimal unitPrice,
            int qty,
            BigDecimal lineSubtotal,
            BigDecimal lineDiscount,
            BigDecimal lineTotal,
            Instant now
    ) {
        OrderLineItemEntity item = new OrderLineItemEntity();
        item.setOrder(order);
        item.setProductId(tryParseUUID(product.getId()));
        item.setProductVariantId(variant != null ? tryParseUUID(variant.getId()) : null);
        item.setSku(variant != null ? variant.getSku() : product.getSku());
        item.setProductName(product.getName());
        item.setVariantName(variant != null ? variant.getName() : null);
        item.setQuantity(qty);
        item.setUnitPrice(unitPrice);
        item.setRegularPrice(product.getRetailPrice());
        item.setSalePrice(product.getSalePrice());
        item.setLineSubtotal(lineSubtotal);
        item.setLineDiscount(lineDiscount);
        item.setLineTax(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        item.setLineTotal(lineTotal);
        item.setCreatedAt(now);
        item.setUpdatedAt(now);
        return item;
    }

    private OrderAddressEntity buildAddress(
            OrderEntity order, String type, CheckoutAddressRequest addr, Instant now
    ) {
        OrderAddressEntity entity = new OrderAddressEntity();
        entity.setOrder(order);
        entity.setType(type);
        entity.setFullName(addr.fullName());
        entity.setEmail(addr.email());
        entity.setPhone(addr.phone());
        entity.setCountry(addr.country() != null ? addr.country() : "VN");
        entity.setProvince(addr.province());
        entity.setDistrict(addr.district());
        entity.setWard(addr.ward());
        entity.setAddressLine1(addr.addressLine1());
        entity.setAddressLine2(addr.addressLine2());
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return entity;
    }

    private OrderShippingItemEntity buildShippingItem(
            OrderEntity order, ShippingMethodEntity method, BigDecimal cost, Instant now
    ) {
        OrderShippingItemEntity item = new OrderShippingItemEntity();
        item.setOrder(order);
        item.setShippingMethodId(method.getId());
        item.setMethodCode(method.getMethodCode());
        item.setMethodTitle(method.getTitle());
        item.setAmount(cost);
        item.setCreatedAt(now);
        item.setUpdatedAt(now);
        return item;
    }

    private PaymentEntity buildPayment(
            OrderEntity order, String paymentMethod, BigDecimal amount, Instant now
    ) {
        PaymentEntity payment = new PaymentEntity();
        payment.setOrder(order);
        payment.setPaymentMethod(paymentMethod);
        payment.setProvider("INTERNAL");
        payment.setStatus(PAYMENT_RECORD_STATUS_PENDING);
        payment.setAmount(amount);
        payment.setCurrency(CURRENCY_VND);
        payment.setCreatedAt(now);
        payment.setUpdatedAt(now);
        return payment;
    }

    private OrderNoteEntity buildSystemNote(OrderEntity order, String content, Instant now) {
        OrderNoteEntity note = new OrderNoteEntity();
        note.setOrder(order);
        note.setAuthorType("system");
        note.setNoteType("SYSTEM");
        note.setContent(content);
        note.setCustomerVisible(false);
        note.setCreatedAt(now);
        return note;
    }

    private OrderSummaryResponse toSummary(OrderEntity order, String paymentMethod) {
        return new OrderSummaryResponse(
                order.getId(),
                order.getOrderNumber(),
                order.getOrderKey(),
                order.getStatus(),
                order.getPaymentStatus(),
                paymentMethod,
                order.getSubtotalAmount(),
                order.getShippingAmount(),
                order.getDiscountAmount(),
                order.getTotalAmount(),
                order.getCurrency()
        );
    }

    private BigDecimal resolveUnitPrice(ProductEntity product, ProductVariantEntity variant) {
        if (variant != null) {
            BigDecimal vp = variant.getSalePrice() != null ? variant.getSalePrice() : variant.getRetailPrice();
            if (vp != null) return vp.setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal p = product.getSalePrice() != null ? product.getSalePrice() : product.getRetailPrice();
        return p.setScale(2, RoundingMode.HALF_UP);
    }

    private UUID tryParseUUID(String id) {
        if (id == null) return null;
        try { return UUID.fromString(id); } catch (IllegalArgumentException e) { return null; }
    }
}
