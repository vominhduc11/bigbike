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
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.CheckoutIdempotencyKeyEntity;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAddressEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAppliedCouponEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderNoteEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderShippingItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import com.bigbike.bigbike_backend.persistence.entity.shipping.ShippingMethodEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartCouponJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.CheckoutIdempotencyKeyJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderAppliedCouponJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderNoteJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderShippingItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.coupon.CouponJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.shipping.ShippingMethodJpaRepository;
import com.bigbike.bigbike_backend.service.cart.CartCalculator;
import com.bigbike.bigbike_backend.service.coupon.CouponPolicyService;
import com.bigbike.bigbike_backend.service.inventory.InventoryPolicyService;
import com.bigbike.bigbike_backend.service.inventory.SerialLifecycleService;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.service.ws.AdminOrderWsService;
import com.bigbike.bigbike_backend.service.ws.OrderWsEvent;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CheckoutService {

    private static final Set<String> ALLOWED_PAYMENT_METHODS = Set.of("COD", "BACS");
    private static final String CART_STATUS_CONVERTED = "CONVERTED";
    private static final String ORDER_STATUS_PROCESSING = "PROCESSING";
    private static final String ORDER_STATUS_ON_HOLD = "ON_HOLD";
    private static final String PAYMENT_STATUS_UNPAID = "UNPAID";
    private static final String PAYMENT_RECORD_STATUS_PENDING = "PENDING";
    private static final String FULFILLMENT_STATUS_UNFULFILLED = "UNFULFILLED";
    private static final String CURRENCY_VND = "VND";
    private static final String FLOW_CHECKOUT = "CHECKOUT";
    private static final String FLOW_QUICK_BUY = "QUICK_BUY";
    private static final String ANONYMOUS_SCOPE = "anonymous";

    private final CartJpaRepository cartRepo;
    private final CartCouponJpaRepository cartCouponRepo;
    private final CheckoutIdempotencyKeyJpaRepository checkoutIdempotencyKeyRepo;
    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final OrderAddressJpaRepository addressRepo;
    private final OrderAppliedCouponJpaRepository orderAppliedCouponRepo;
    private final OrderShippingItemJpaRepository shippingItemRepo;
    private final OrderNoteJpaRepository noteRepo;
    private final PaymentJpaRepository paymentRepo;
    private final ShippingMethodJpaRepository shippingMethodRepo;
    private final ProductJpaRepository productRepo;
    private final ProductVariantJpaRepository variantRepo;
    private final StockMovementJpaRepository stockMovementRepo;
    private final CouponJpaRepository couponRepo;
    private final OrderNumberGenerator orderNumberGenerator;
    private final OrderKeyGenerator orderKeyGenerator;
    private final CartCalculator cartCalculator;
    private final OrderNotificationService orderNotificationService;
    private final AdminOrderWsService adminOrderWsService;
    private final InventoryPolicyService inventoryPolicyService;
    private final SerialLifecycleService serialLifecycleService;
    private final CouponPolicyService couponPolicy;
    private final JdbcTemplate jdbcTemplate;
    private final WebRevalidationService webRevalidationService;

    // ── Checkout from cart ────────────────────────────────────────────────────

    @Transactional
    public OrderSummaryResponse checkoutFromCart(
            CartEntity cart,
            List<CartItemEntity> items,
            CheckoutRequest req,
            UUID customerId,
            String guestSessionId,
            String idempotencyKey,
            String clientIp,
            String userAgent
    ) {
        IdempotencyReservation idempotency = reserveIdempotency(
                FLOW_CHECKOUT, customerId, guestSessionId, idempotencyKey, req);
        if (idempotency.existingSummary() != null) {
            return idempotency.existingSummary();
        }
        if (items.isEmpty()) {
            throw ValidationException.fromField("cart", "EMPTY_CART", "Cart has no items.");
        }
        validateAddress(req.billingAddress());
        validatePaymentMethod(req.paymentMethod());
        // Validate stock and re-sync prices. Stock is NOT decremented yet so we have an orderId.
        List<OrderSummaryResponse.PriceChange> priceChanges = new ArrayList<>();
        syncPricesAndValidateStock(items, priceChanges);

        // Reject if any product prices increased since the customer loaded the checkout page.
        // Prevents silent overcharges. Price decreases are applied silently (customer benefits).
        // The transaction rolls back so cart prices revert; CartService will re-sync on the next fetch.
        List<OrderSummaryResponse.PriceChange> priceIncreases = priceChanges.stream()
                .filter(pc -> pc.newPrice().compareTo(pc.oldPrice()) > 0)
                .toList();
        if (!priceIncreases.isEmpty()) {
            String detail = priceIncreases.stream()
                    .map(pc -> pc.productName())
                    .collect(Collectors.joining(", "));
            throw new ConflictException(
                    "Giá của một số sản phẩm vừa thay đổi: " + detail +
                    ". Vui lòng quay lại giỏ hàng để xem giá mới trước khi đặt hàng.");
        }

        BigDecimal subtotal = items.stream()
                .map(CartItemEntity::getLineSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        // Reload, revalidate, and recompute each coupon from fresh DB data before creating the order
        record CouponRedemption(
                String code,
                com.bigbike.bigbike_backend.persistence.entity.coupon.CouponEntity coupon,
                BigDecimal freshDiscount
        ) {}
        List<com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartCouponEntity> cartCoupons =
                cartCouponRepo.findByCartId(cart.getId());
        String callerCustomerId = customerId != null ? customerId.toString() : null;
        List<CouponRedemption> couponRedemptions = new ArrayList<>();
        for (var cc : cartCoupons) {
            com.bigbike.bigbike_backend.persistence.entity.coupon.CouponEntity freshCoupon =
                    couponRepo.findByCode(cc.getCouponCode())
                            .orElseThrow(() -> new ConflictException(
                                    "Mã giảm giá '" + cc.getCouponCode() + "' không còn tồn tại."));
            couponPolicy.validateChannel(freshCoupon, "ONLINE");
            couponPolicy.validateCustomer(freshCoupon, callerCustomerId);
            couponPolicy.validate(freshCoupon, subtotal);
            couponRedemptions.add(new CouponRedemption(
                    cc.getCouponCode(), freshCoupon, couponPolicy.computeDiscount(freshCoupon, subtotal)));
        }

        BigDecimal discount = couponRedemptions.stream()
                .map(CouponRedemption::freshDiscount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        String shippingProvince = resolveShippingAddress(req.billingAddress(), req.shippingAddress()).province();
        ShippingMethodEntity shippingMethod = resolveShippingMethod(req.shippingMethodId(), shippingProvince);
        BigDecimal shippingCost = resolveShippingCost(shippingMethod, subtotal);
        BigDecimal total = subtotal.subtract(discount).add(shippingCost).max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);

        Instant now = Instant.now();
        OrderEntity order = buildOrder(
                customerId,
                req.billingAddress().email(),
                req.billingAddress().phone(),
                req.billingAddress().fullName(),
                req.customerNote(),
                req.paymentMethod(),
                subtotal,
                discount,
                shippingCost,
                total,
                "checkout",
                clientIp,
                userAgent,
                now
        );
        OrderEntity savedOrder = orderRepo.saveAndFlush(order);

        // Save line items first — serial reservation needs the line item ID.
        List<OrderLineItemEntity> savedLineItems = new ArrayList<>();
        for (CartItemEntity cartItem : items) {
            savedLineItems.add(lineItemRepo.save(buildLineItemFromCart(savedOrder, cartItem, now)));
        }

        // Decrement stock / reserve serials per line item.
        applyStockForLineItems(savedLineItems, items, savedOrder.getId(), now);

        // Addresses
        addressRepo.save(buildAddress(savedOrder, "BILLING", req.billingAddress(), now));
        CheckoutAddressRequest shippingAddr = resolveShippingAddress(req.billingAddress(), req.shippingAddress());
        addressRepo.save(buildAddress(savedOrder, "SHIPPING", shippingAddr, now));

        // Shipping item
        shippingItemRepo.save(buildShippingItem(savedOrder, shippingMethod, shippingCost, now));

        // Payment
        paymentRepo.save(buildPayment(savedOrder, req.paymentMethod(), total, now));

        // Atomically increment usageCount and snapshot each coupon onto the order
        List<String> couponCodes = couponRedemptions.stream()
                .map(CouponRedemption::code).toList();
        for (CouponRedemption redemption : couponRedemptions) {
            // Conditional UPDATE: returns 0 rows if another checkout exhausted the limit concurrently
            int redeemed = couponRepo.attemptRedeem(redemption.coupon().getId(), now);
            if (redeemed == 0) {
                throw new ConflictException("Mã giảm giá không còn hiệu lực hoặc đã đạt giới hạn sử dụng.");
            }
            OrderAppliedCouponEntity appliedCoupon = new OrderAppliedCouponEntity();
            appliedCoupon.setOrder(savedOrder);
            appliedCoupon.setCouponId(redemption.coupon().getId());
            appliedCoupon.setCode(redemption.code());
            appliedCoupon.setDiscountAmount(redemption.freshDiscount());
            appliedCoupon.setCreatedAt(now);
            orderAppliedCouponRepo.save(appliedCoupon);
        }

        // System note
        String couponNote = couponCodes.isEmpty() ? "" : ". Mã giảm giá: " + String.join(", ", couponCodes);
        noteRepo.save(buildSystemNote(savedOrder,
                "Đơn hàng được tạo. Phương thức thanh toán: " + req.paymentMethod() +
                ". Phương thức vận chuyển: " + shippingMethod.getTitle() + couponNote + ".", now));

        // Mark cart converted
        cart.setStatus(CART_STATUS_CONVERTED);
        cart.setUpdatedAt(now);
        cartRepo.save(cart);

        orderNotificationService.sendOrderConfirmation(savedOrder, req.paymentMethod());
        orderNotificationService.sendAdminNewOrderNotification(savedOrder, req.paymentMethod());
        adminOrderWsService.pushEvent(buildNewOrderEvent(savedOrder, req.paymentMethod()));

        attachOrderToReservation(idempotency, savedOrder.getId(), now);
        webRevalidationService.revalidateProductsForOrder(savedOrder.getId());
        return toSummary(savedOrder, req.paymentMethod(), priceChanges);
    }

    // ── Quick-buy ─────────────────────────────────────────────────────────────

    @Transactional
    public OrderSummaryResponse quickBuy(
            QuickBuyRequest req,
            UUID customerId,
            String guestSessionId,
            String idempotencyKey,
            String clientIp,
            String userAgent
    ) {
        IdempotencyReservation idempotency = reserveIdempotency(
                FLOW_QUICK_BUY, customerId, guestSessionId, idempotencyKey, req);
        if (idempotency.existingSummary() != null) {
            return idempotency.existingSummary();
        }
        validateAddress(req.billingAddress());
        validatePaymentMethod(req.paymentMethod());

        ProductEntity product = productRepo.findByIdForUpdate(req.productId().toString())
                .orElseThrow(() -> new NotFoundException("Product not found: " + req.productId()));
        if (product.getPublishStatus() != PublishStatus.PUBLISHED) {
            throw new ConflictException("Product is not available.");
        }

        ProductVariantEntity variant = null;
        if (req.productVariantId() != null && !req.productVariantId().isBlank()) {
            variant = variantRepo.findByIdForUpdate(req.productVariantId())
                    .orElseThrow(() -> new NotFoundException("Variant not found: " + req.productVariantId()));
            if (!variant.isAvailable()) {
                throw new ConflictException("Sản phẩm '" + product.getName() + "' tạm ngừng bán.");
            }
            if (variant.isTrackSerials()) {
                long available = serialLifecycleService.countAvailable(product.getId(), variant.getId());
                if (available < req.quantity()) {
                    throw new ConflictException(available <= 0
                            ? "Sản phẩm '" + product.getName() + "' hết hàng."
                            : "Sản phẩm '" + product.getName() + "' chỉ còn " + available + " trong kho.");
                }
            } else {
                if (variant.getQuantityOnHand() < req.quantity()) {
                    int onHand = variant.getQuantityOnHand();
                    throw new ConflictException(onHand <= 0
                            ? "Sản phẩm '" + product.getName() + "' hết hàng."
                            : "Sản phẩm '" + product.getName() + "' chỉ còn " + onHand + " trong kho.");
                }
            }
        } else {
            if (Boolean.TRUE.equals(product.getForceOutOfStock())
                    || product.getStockState() == ProductStockState.OUT_OF_STOCK) {
                throw new ConflictException("Sản phẩm '" + product.getName() + "' hết hàng.");
            }
            if (product.isTrackSerials()) {
                long available = serialLifecycleService.countAvailable(product.getId(), null);
                if (available < req.quantity()) {
                    throw new ConflictException(available <= 0
                            ? "Sản phẩm '" + product.getName() + "' hết hàng."
                            : "Sản phẩm '" + product.getName() + "' chỉ còn " + available + " trong kho.");
                }
            } else if (Boolean.TRUE.equals(product.getManageStock()) && product.getStockQuantity() != null
                    && product.getStockQuantity() < req.quantity()) {
                throw new ConflictException("Sản phẩm '" + product.getName() + "' chỉ còn "
                        + product.getStockQuantity() + " trong kho.");
            }
        }

        BigDecimal unitPrice = resolveUnitPrice(product, variant);
        int qty = req.quantity();
        BigDecimal lineSubtotal = unitPrice.multiply(BigDecimal.valueOf(qty)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal lineDiscount = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        BigDecimal lineTotal = lineSubtotal.subtract(lineDiscount).setScale(2, RoundingMode.HALF_UP);

        ShippingMethodEntity shippingMethod = resolveShippingMethod(req.shippingMethodId(), req.billingAddress().province());
        BigDecimal shippingCost = resolveShippingCost(shippingMethod, lineTotal);
        BigDecimal total = lineTotal.add(shippingCost).setScale(2, RoundingMode.HALF_UP);

        Instant now = Instant.now();
        OrderEntity order = buildOrder(
                customerId,
                req.billingAddress().email(),
                req.billingAddress().phone(),
                req.billingAddress().fullName(),
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
        OrderEntity savedOrder = orderRepo.saveAndFlush(order);

        // Save line item first so serial reservation has a valid ID.
        OrderLineItemEntity savedLineItem = lineItemRepo.save(buildLineItemFromProduct(
                savedOrder, product, variant, unitPrice, qty,
                lineSubtotal, lineDiscount, lineTotal, now));

        if (variant != null && variant.isTrackSerials()) {
            Instant reservedUntil = serialLifecycleService.computeReservedUntil();
            serialLifecycleService.reserveForOrderLine(
                    savedLineItem, product.getId(), variant.getId(), qty, reservedUntil);
        } else if (variant != null) {
            decrementVariantStock(variant, qty, savedOrder.getId(), now);
        } else if (product.isTrackSerials()) {
            Instant reservedUntil = serialLifecycleService.computeReservedUntil();
            serialLifecycleService.reserveForOrderLine(
                    savedLineItem, product.getId(), null, qty, reservedUntil);
        } else if (Boolean.TRUE.equals(product.getManageStock()) && product.getStockQuantity() != null) {
            int newQty = product.getStockQuantity() - qty;
            product.setStockQuantity(newQty);
            int threshold = inventoryPolicyService.lowStockThreshold();
            if (newQty <= 0) {
                product.setStockState(ProductStockState.OUT_OF_STOCK);
            } else if (newQty <= threshold) {
                product.setStockState(ProductStockState.LOW_STOCK);
            }
            productRepo.save(product);
        }

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

        orderNotificationService.sendOrderConfirmation(savedOrder, req.paymentMethod());
        orderNotificationService.sendAdminNewOrderNotification(savedOrder, req.paymentMethod());
        adminOrderWsService.pushEvent(buildNewOrderEvent(savedOrder, req.paymentMethod()));

        attachOrderToReservation(idempotency, savedOrder.getId(), now);
        webRevalidationService.revalidateProductsForOrder(savedOrder.getId());
        return toSummary(savedOrder, req.paymentMethod(), List.of());
    }

    // ── Checkout options ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
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
                        m.getCost() != null ? m.getCost() : BigDecimal.ZERO,
                        m.getFreeShippingThreshold(),
                        m.getMinOrderAmount(),
                        m.getZone().getRegionCode()
                ))
                .toList();
        return new CheckoutOptionsResponse(paymentMethods, shippingMethods);
    }

    // ── Shipping cost helpers ─────────────────────────────────────────────────

    private BigDecimal resolveShippingCost(ShippingMethodEntity method, BigDecimal orderSubtotal) {
        BigDecimal minOrder = method.getMinOrderAmount();
        if (minOrder != null && minOrder.compareTo(BigDecimal.ZERO) > 0
                && orderSubtotal.compareTo(minOrder) < 0) {
            throw ValidationException.fromField("shippingMethodId", "MIN_ORDER_AMOUNT_NOT_MET",
                    "Order subtotal does not meet the minimum order amount for this shipping method.");
        }
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
        if (addr.phone() == null || !addr.phone().matches("0[3-9]\\d{8}|\\+84[3-9]\\d{8}")) {
            throw ValidationException.fromField("billingAddress.phone", "INVALID_PHONE",
                    "Số điện thoại không hợp lệ. Vui lòng nhập số VN 10 chữ số (ví dụ: 0901234567).");
        }
        if (addr.email() != null && !addr.email().isBlank()
                && !addr.email().matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw ValidationException.fromField("billingAddress.email", "INVALID_EMAIL",
                    "Email không hợp lệ.");
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

    private <T> IdempotencyReservation reserveIdempotency(
            String flowType,
            UUID customerId,
            String guestSessionId,
            String rawIdempotencyKey,
            T requestBody
    ) {
        String idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);
        if (idempotencyKey == null) {
            return IdempotencyReservation.none();
        }

        String scopeKey = buildScopeKey(customerId, guestSessionId);
        String requestHash = hashRequest(requestBody);
        Instant now = Instant.now();
        UUID reservationId = UUID.randomUUID();

        try {
            jdbcTemplate.update(
                    """
                    INSERT INTO checkout_idempotency_keys
                        (id, flow_type, scope_key, customer_id, guest_session_id,
                         idempotency_key, request_hash, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    reservationId,
                    flowType,
                    scopeKey,
                    customerId,
                    guestSessionId,
                    idempotencyKey,
                    requestHash,
                    java.sql.Timestamp.from(now),
                    java.sql.Timestamp.from(now)
            );
            return new IdempotencyReservation(reservationId, null);
        } catch (DataIntegrityViolationException ex) {
            CheckoutIdempotencyKeyEntity existing = checkoutIdempotencyKeyRepo
                    .findByFlowTypeAndScopeKeyAndIdempotencyKey(flowType, scopeKey, idempotencyKey)
                    .orElseThrow(() -> new ConflictException(
                            "Idempotency key is already in use. Please retry with a new key."));
            if (!existing.getRequestHash().equals(requestHash)) {
                throw new ConflictException(
                        "Idempotency key was already used for a different request payload.");
            }
            return new IdempotencyReservation(null, loadExistingSummary(existing));
        }
    }

    private void attachOrderToReservation(IdempotencyReservation reservation, UUID orderId, Instant now) {
        if (reservation.reservationId() == null) {
            return;
        }
        checkoutIdempotencyKeyRepo.attachOrder(reservation.reservationId(), orderId, now);
    }

    private OrderSummaryResponse loadExistingSummary(CheckoutIdempotencyKeyEntity existing) {
        if (existing.getOrderId() == null) {
            throw new ConflictException(
                    "A request with this Idempotency-Key is already being processed. Please retry shortly.");
        }
        OrderEntity order = orderRepo.findById(existing.getOrderId())
                .orElseThrow(() -> new ConflictException(
                        "Existing order for this Idempotency-Key could not be loaded."));
        return toSummary(order, resolveSummaryPaymentMethod(order), List.of());
    }

    private String resolveSummaryPaymentMethod(OrderEntity order) {
        if (order.getPaymentMethod() != null && !order.getPaymentMethod().isBlank()) {
            return order.getPaymentMethod();
        }
        return paymentRepo.findByOrderId(order.getId()).stream()
                .map(PaymentEntity::getPaymentMethod)
                .filter(method -> method != null && !method.isBlank())
                .findFirst()
                .orElse(null);
    }

    private String normalizeIdempotencyKey(String rawIdempotencyKey) {
        if (rawIdempotencyKey == null) {
            return null;
        }
        String idempotencyKey = rawIdempotencyKey.trim();
        if (idempotencyKey.isEmpty()) {
            return null;
        }
        if (idempotencyKey.length() > 255) {
            throw ValidationException.fromField(
                    "Idempotency-Key",
                    "INVALID",
                    "Idempotency-Key must be 255 characters or less."
            );
        }
        return idempotencyKey;
    }

    private String buildScopeKey(UUID customerId, String guestSessionId) {
        if (customerId != null) {
            return "customer:" + customerId;
        }
        if (guestSessionId != null && !guestSessionId.isBlank()) {
            return "guest:" + guestSessionId;
        }
        return ANONYMOUS_SCOPE;
    }

    private String hashRequest(Object requestBody) {
        try {
            byte[] payload = String.valueOf(requestBody).getBytes(StandardCharsets.UTF_8);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(payload));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available.", e);
        }
    }

    private ShippingMethodEntity resolveShippingMethod(String shippingMethodId, String province) {
        ShippingMethodEntity method;
        if (shippingMethodId != null && !shippingMethodId.isBlank()) {
            UUID id;
            try {
                id = UUID.fromString(shippingMethodId);
            } catch (IllegalArgumentException e) {
                throw ValidationException.fromField("shippingMethodId", "INVALID",
                        "Shipping method ID is invalid.");
            }
            method = shippingMethodRepo.findById(id)
                    .orElseThrow(() -> ValidationException.fromField("shippingMethodId", "NOT_FOUND",
                            "Shipping method not found."));
            if (!method.isEnabled()) {
                throw ValidationException.fromField("shippingMethodId", "DISABLED",
                        "Shipping method is disabled.");
            }
        } else {
            // Auto-select if exactly one enabled method
            List<ShippingMethodEntity> enabled = shippingMethodRepo.findByEnabledOrderBySortOrderAsc(true);
            if (enabled.size() == 1) {
                method = enabled.get(0);
            } else {
                throw ValidationException.fromField("shippingMethodId", "REQUIRED",
                        "Shipping method is required when multiple methods are available.");
            }
        }

        // Lenient zone check: only enforce if zone has a known region code (MB/MT/MN)
        String zoneRegionCode = method.getZone().getRegionCode();
        if (zoneRegionCode != null && VietnamRegionMapper.KNOWN_REGION_CODES.contains(zoneRegionCode)) {
            String customerRegion = VietnamRegionMapper.getRegion(province);
            if (customerRegion != null && !customerRegion.equals(zoneRegionCode)) {
                throw ValidationException.fromField("shippingMethodId", "SHIPPING_ZONE_MISMATCH",
                        "Selected shipping method is not available for the delivery province.");
            }
        }
        return method;
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
            String customerName,
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
        // Web/quick-buy orders always ship — initialise the delivery lifecycle
        // so admin transitions and the COMPLETED-after-DELIVERED guard
        // (AdminOrderService#validateBeforeComplete) operate on a known state.
        order.setFulfillmentStatus(FULFILLMENT_STATUS_UNFULFILLED);
        order.setPaymentMethod(paymentMethod);
        order.setCustomerEmail(email);
        order.setCustomerPhone(phone);
        order.setCustomerName(customerName);
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
        item.setProductPk(cartItem.getProductPk());
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
        item.setProductPk(product.getId());
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
        note.setAuthorType("SYSTEM");
        note.setNoteType("SYSTEM");
        note.setContent(content);
        note.setCustomerVisible(false);
        note.setCreatedAt(now);
        return note;
    }

    private OrderSummaryResponse toSummary(OrderEntity order, String paymentMethod,
            List<OrderSummaryResponse.PriceChange> priceChanges) {
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
                order.getCurrency(),
                priceChanges
        );
    }

    /**
     * Pass 1: validate stock availability and re-sync prices from DB.
     * For serial-tracked variants, validates against IN_STOCK serial count (not quantity_on_hand).
     * Does NOT write any stock changes.
     */
    private void syncPricesAndValidateStock(List<CartItemEntity> items,
            List<OrderSummaryResponse.PriceChange> priceChanges) {
        for (CartItemEntity cartItem : items) {
            if (cartItem.getProductId() == null) continue;
            ProductEntity product = productRepo.findByIdForUpdate(cartItem.getProductId().toString())
                    .orElseThrow(() -> new ConflictException(
                            "Product no longer exists: " + cartItem.getProductName()));

            ProductVariantEntity variant = null;
            if (cartItem.getProductVariantId() != null) {
                variant = variantRepo
                        .findByIdForUpdate(cartItem.getProductVariantId().toString())
                        .orElseThrow(() -> new ConflictException(
                                "Variant no longer exists for: " + cartItem.getProductName()));
                if (!variant.isAvailable()) {
                    throw new ConflictException(
                            "Sản phẩm '" + cartItem.getProductName() + "' tạm ngừng bán.");
                }
                if (variant.isTrackSerials()) {
                    // Serial-only: count actual IN_STOCK serials, not quantity_on_hand
                    long available = serialLifecycleService.countAvailable(
                            product.getId(), variant.getId());
                    if (available < cartItem.getQuantity()) {
                        throw new ConflictException(available <= 0
                                ? "Sản phẩm '" + cartItem.getProductName() + "' hết hàng."
                                : "Sản phẩm '" + cartItem.getProductName() + "' chỉ còn " + available + " trong kho.");
                    }
                } else {
                    if (variant.getQuantityOnHand() < cartItem.getQuantity()) {
                        int onHand = variant.getQuantityOnHand();
                        throw new ConflictException(onHand <= 0
                                ? "Sản phẩm '" + cartItem.getProductName() + "' hết hàng."
                                : "Sản phẩm '" + cartItem.getProductName() + "' chỉ còn " + onHand + " trong kho.");
                    }
                }
            } else {
                if (Boolean.TRUE.equals(product.getForceOutOfStock())
                        || product.getStockState() == ProductStockState.OUT_OF_STOCK) {
                    throw new ConflictException(
                            "Sản phẩm '" + cartItem.getProductName() + "' hết hàng.");
                }
                if (product.isTrackSerials()) {
                    long available = serialLifecycleService.countAvailable(product.getId(), null);
                    if (available < cartItem.getQuantity()) {
                        throw new ConflictException(available <= 0
                                ? "Sản phẩm '" + cartItem.getProductName() + "' hết hàng."
                                : "Sản phẩm '" + cartItem.getProductName() + "' chỉ còn " + available + " trong kho.");
                    }
                } else if (Boolean.TRUE.equals(product.getManageStock()) && product.getStockQuantity() != null
                        && product.getStockQuantity() < cartItem.getQuantity()) {
                    throw new ConflictException(
                            "Sản phẩm '" + cartItem.getProductName() + "' chỉ còn " +
                            product.getStockQuantity() + " trong kho.");
                }
            }

            BigDecimal currentPrice = resolveUnitPrice(product, variant);
            BigDecimal cartPrice = cartItem.getUnitPrice();
            if (cartPrice != null && cartPrice.compareTo(currentPrice) != 0) {
                priceChanges.add(new OrderSummaryResponse.PriceChange(
                        cartItem.getProductName(), cartPrice, currentPrice));
            }
            cartItem.setUnitPrice(currentPrice);
            cartCalculator.recalculateItem(cartItem);
        }
    }

    /**
     * Pass 2: for each saved line item, either reserve serials (serial-tracked)
     * or decrement quantity_on_hand (legacy path).
     * Line items must already be persisted so they have valid IDs for bridge records.
     */
    private void applyStockForLineItems(List<OrderLineItemEntity> savedLineItems,
                                        List<CartItemEntity> cartItems,
                                        UUID orderId, Instant now) {
        int threshold = inventoryPolicyService.lowStockThreshold();
        for (int i = 0; i < savedLineItems.size(); i++) {
            OrderLineItemEntity lineItem = savedLineItems.get(i);
            CartItemEntity cartItem = cartItems.get(i);
            if (cartItem.getProductId() == null) continue;

            if (cartItem.getProductVariantId() != null) {
                variantRepo.findByIdForUpdate(cartItem.getProductVariantId().toString())
                        .ifPresent(variant -> {
                            if (variant.isTrackSerials()) {
                                Instant reservedUntil = serialLifecycleService.computeReservedUntil();
                                serialLifecycleService.reserveForOrderLine(
                                        lineItem,
                                        cartItem.getProductId().toString(),
                                        variant.getId(),
                                        cartItem.getQuantity(),
                                        reservedUntil);
                            } else {
                                decrementVariantStock(variant, cartItem.getQuantity(), orderId, now);
                            }
                        });
            } else {
                productRepo.findByIdForUpdate(cartItem.getProductId().toString()).ifPresent(product -> {
                    if (product.isTrackSerials()) {
                        Instant reservedUntil = serialLifecycleService.computeReservedUntil();
                        serialLifecycleService.reserveForOrderLine(
                                lineItem,
                                product.getId(),
                                null,
                                cartItem.getQuantity(),
                                reservedUntil);
                        return;
                    }
                    if (!Boolean.TRUE.equals(product.getManageStock()) || product.getStockQuantity() == null) return;
                    int newQty = product.getStockQuantity() - cartItem.getQuantity();
                    product.setStockQuantity(newQty);
                    product.setStockState(newQty <= 0 ? ProductStockState.OUT_OF_STOCK
                            : (newQty <= threshold ? ProductStockState.LOW_STOCK : ProductStockState.IN_STOCK));
                    productRepo.save(product);
                });
            }
        }
    }

    private void decrementVariantStock(ProductVariantEntity variant, int qty, UUID orderId, Instant now) {
        int before = variant.getQuantityOnHand();
        int after = before - qty;
        variant.setQuantityOnHand(after);
        inventoryPolicyService.recomputeStockState(variant);
        variantRepo.save(variant);

        StockMovementEntity movement = new StockMovementEntity();
        movement.setVariant(variant);
        movement.setMovementType("OUT");
        movement.setQuantityDelta(-qty);
        movement.setQuantityBefore(before);
        movement.setQuantityAfter(after);
        movement.setReferenceType("ORDER");
        movement.setReferenceId(orderId);
        movement.setCreatedAt(now);
        stockMovementRepo.save(movement);
    }

    private record IdempotencyReservation(UUID reservationId, OrderSummaryResponse existingSummary) {
        private static IdempotencyReservation none() {
            return new IdempotencyReservation(null, null);
        }
    }

    /**
     * Order unit price always comes from the parent product. Variant-level
     * price columns are intentionally ignored — the storefront and cart
     * display the product price regardless of variant, so checkout must
     * agree to keep the displayed total consistent with what the customer
     * paid.
     */
    private BigDecimal resolveUnitPrice(ProductEntity product, ProductVariantEntity variant) {
        BigDecimal p = product.getSalePrice() != null ? product.getSalePrice() : product.getRetailPrice();
        return p.setScale(2, RoundingMode.HALF_UP);
    }

    private UUID tryParseUUID(String id) {
        if (id == null) return null;
        try { return UUID.fromString(id); } catch (IllegalArgumentException e) { return null; }
    }

    private OrderWsEvent buildNewOrderEvent(OrderEntity order, String paymentMethod) {
        String customerName = order.getCustomerEmail() != null && !order.getCustomerEmail().isBlank()
                ? order.getCustomerEmail()
                : (order.getCustomerPhone() != null ? order.getCustomerPhone() : "Khách hàng");
        return new OrderWsEvent(
                "NEW_ORDER",
                order.getId(),
                order.getOrderNumber(),
                customerName,
                order.getTotalAmount(),
                order.getStatus(),
                paymentMethod,
                java.time.Instant.now()
        );
    }
}
