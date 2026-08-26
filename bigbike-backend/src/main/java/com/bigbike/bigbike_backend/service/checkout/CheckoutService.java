package com.bigbike.bigbike_backend.service.checkout;

import com.bigbike.bigbike_backend.api.checkout.dto.CheckoutAddressRequest;
import com.bigbike.bigbike_backend.api.checkout.dto.CheckoutRequest;
import com.bigbike.bigbike_backend.api.checkout.dto.OrderSummaryResponse;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.commerce.PaymentRecordStatus;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.CheckoutIdempotencyKeyEntity;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatOrderAttributionEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.CheckoutIdempotencyKeyJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatOrderAttributionJpaRepository;
import com.bigbike.bigbike_backend.service.cart.CartCalculator;
import com.bigbike.bigbike_backend.service.chat.ChatInteractionService;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.service.ws.AdminOrderWsService;
import static com.bigbike.bigbike_backend.service.checkout.CheckoutSupport.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@RequiredArgsConstructor
public class CheckoutService {

    private static final String CART_STATUS_CONVERTED = "CONVERTED";
    private static final String CURRENCY_VND = "VND";
    private static final String FLOW_CHECKOUT = "CHECKOUT";

    private final CartJpaRepository cartRepo;
    private final CheckoutIdempotencyKeyJpaRepository checkoutIdempotencyKeyRepo;
    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final OrderAddressJpaRepository addressRepo;
    private final PaymentJpaRepository paymentRepo;
    private final ProductJpaRepository productRepo;
    private final ProductVariantJpaRepository variantRepo;
    private final OrderNumberGenerator orderNumberGenerator;
    private final OrderKeyGenerator orderKeyGenerator;
    private final CartCalculator cartCalculator;
    private final OrderNotificationService orderNotificationService;
    private final AdminOrderWsService adminOrderWsService;
    private final JdbcTemplate jdbcTemplate;
    private final WebRevalidationService webRevalidationService;
    private final ChatOrderAttributionJpaRepository chatOrderAttributionRepo;
    private final ChatInteractionService chatInteractionService;

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
        // No maintenance guard here by design: the storefront is never put into maintenance, so
        // customers can always order even while the admin panel is locked
        // (BUSINESS_RULES `MAINTENANCE_RULE_002`, owner decision 2026-08-06).
        IdempotencyReservation idempotency = reserveIdempotency(
                FLOW_CHECKOUT, customerId, guestSessionId, idempotencyKey, req);
        if (idempotency.existingSummary() != null) {
            return idempotency.existingSummary();
        }
        if (items.isEmpty()) {
            throw ValidationException.fromField("cart", "EMPTY_CART", "Cart has no items.");
        }
        validateAddress(req.billingAddress());
        // Resolve + re-validate the shipping address up front so a custom shipping block can
        // never persist an undeliverable (blank province/ward) address (AUD-007).
        CheckoutAddressRequest shippingAddr = resolveShippingAddress(req.billingAddress(), req.shippingAddress());
        validateAddress(shippingAddr, "shippingAddress");
        validatePaymentMethod(req.paymentMethod());
        String paymentMethod = normalizePaymentMethod(req.paymentMethod());
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

        // Coupons removed (owner decision 2026-06-23): orders never carry a discount.
        BigDecimal discount = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        // Shipping method choice removed (owner decision 2026-06-23): online orders no longer pick a
        // shipping method and carry no shipping fee — the shop arranges delivery offline.
        BigDecimal shippingCost = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = subtotal.subtract(discount).max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);

        Instant now = Instant.now();
        OrderEntity order = buildOrder(
                customerId,
                req.billingAddress().email(),
                req.billingAddress().phone(),
                req.billingAddress().fullName(),
                req.customerNote(),
                paymentMethod,
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

        // Persist line items.
        for (CartItemEntity cartItem : items) {
            OrderLineItemEntity lineItem = lineItemRepo.save(
                    buildLineItemFromCart(savedOrder, cartItem, now));
            String attributedProductSlug = cartItem.getProductPk() == null ? null
                    : productRepo.findById(cartItem.getProductPk())
                            .map(ProductEntity::getSlug)
                            .orElse(null);
            Instant attributedTouchAt = cartItem.getAssistantAttributedAt() != null
                    ? cartItem.getAssistantAttributedAt() : cartItem.getUpdatedAt();
            if (chatInteractionService.isEligibleAtCheckout(
                        cartItem.getAssistantInteractionId(),
                        cartItem.getAssistantConversationId(),
                        attributedProductSlug,
                        attributedTouchAt)
                    && !chatOrderAttributionRepo.existsByOrderLineItemId(lineItem.getId())) {
                ChatOrderAttributionEntity attribution = new ChatOrderAttributionEntity();
                attribution.setOrderId(savedOrder.getId());
                attribution.setOrderLineItemId(lineItem.getId());
                attribution.setConversationId(cartItem.getAssistantConversationId());
                attribution.setInteractionId(cartItem.getAssistantInteractionId());
                attribution.setActionType(chatInteractionService.actionType(
                        cartItem.getAssistantInteractionId()));
                attribution.setProductSlug(attributedProductSlug);
                attribution.setTouchAt(attributedTouchAt);
                attribution.setAttributionWindowHours(168);
                attribution.setAttributedAmount(lineItem.getLineTotal());
                attribution.setCurrency(savedOrder.getCurrency());
                attribution.setCreatedAt(now);
                chatOrderAttributionRepo.save(attribution);
            }
        }

        // Inventory is boolean availability only (owner decision 2026-06-23) — no decrement on sale.

        // Addresses
        addressRepo.save(buildAddress(savedOrder, "BILLING", req.billingAddress(), now));
        addressRepo.save(buildAddress(savedOrder, "SHIPPING", shippingAddr, now));

        // Payment
        paymentRepo.save(buildPayment(savedOrder, paymentMethod, total, now));

        // Mark cart converted
        cart.setStatus(CART_STATUS_CONVERTED);
        cart.setUpdatedAt(now);
        cartRepo.save(cart);

        OrderEntity orderSnapshot = savedOrder;
        String paymentMethodSnapshot = paymentMethod;
        // pushEvent() defers its own send until after-commit internally — call it directly
        // (not nested in runAfterCommit below). Registering a new TransactionSynchronization
        // from inside another synchronization's afterCommit() of the same transaction is
        // silently dropped by Spring (verified against this project's Spring version), which
        // was swallowing every NEW_ORDER admin push.
        adminOrderWsService.pushEvent(buildNewOrderEvent(savedOrder, paymentMethod));
        runAfterCommit(() -> {
            orderNotificationService.sendOrderConfirmation(orderSnapshot, paymentMethodSnapshot);
            orderNotificationService.sendAdminNewOrderNotification(orderSnapshot, paymentMethodSnapshot);
        });

        attachOrderToReservation(idempotency, savedOrder.getId(), now);
        webRevalidationService.revalidateProductsForOrder(savedOrder.getId());
        return toSummary(savedOrder, paymentMethod, priceChanges);
    }

    // Quick-buy removed 2026-07-15 (owner decision, reverses AUD-010): the storefront has
    // no quick-buy entry point — customers order through the cart via checkoutFromCart.
    // GET /checkout/options removed 2026-07-15 (AUD-056): COD and BANK_TRANSFER are fixed
    // storefront methods (PAY_RULE_001), so there is no dynamic options endpoint.

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

        // SAVEPOINT protects the outer transaction: if the INSERT fails (duplicate key), PostgreSQL
        // would abort the whole transaction without it, making the subsequent SELECT impossible.
        jdbcTemplate.execute("SAVEPOINT idempotency_sp");
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
            jdbcTemplate.execute("RELEASE SAVEPOINT idempotency_sp");
            return new IdempotencyReservation(reservationId, null);
        } catch (DataIntegrityViolationException ex) {
            jdbcTemplate.execute("ROLLBACK TO SAVEPOINT idempotency_sp");
            jdbcTemplate.execute("RELEASE SAVEPOINT idempotency_sp");
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
        // All new orders enter the single lifecycle at PENDING and are confirmed by the shop.
        String orderStatus = "PENDING";

        OrderEntity order = new OrderEntity();
        order.setOrderNumber(orderNumberGenerator.generate());
        order.setOrderKey(orderKeyGenerator.generate());
        order.setCustomerId(customerId);
        order.setStatus(orderStatus);
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

    private PaymentEntity buildPayment(
            OrderEntity order, String paymentMethod, BigDecimal amount, Instant now
    ) {
        PaymentEntity payment = new PaymentEntity();
        payment.setOrder(order);
        payment.setPaymentMethod(paymentMethod);
        payment.setProvider("INTERNAL");
        payment.setStatus(PaymentRecordStatus.PENDING);
        payment.setAmount(amount);
        payment.setCurrency(CURRENCY_VND);
        payment.setCreatedAt(now);
        payment.setUpdatedAt(now);
        return payment;
    }

    /**
     * Validate boolean availability (variant.isAvailable / product stock_state, owner decision
     * 2026-06-23) and re-sync prices from DB. Does NOT write any stock changes.
     *
     * <p>Locks every product/variant referenced by the cart in one round-trip each
     * ({@code WHERE id IN (:ids)}) instead of one {@code SELECT ... FOR UPDATE} per cart
     * line — carts are almost always 1 line today, but this removes N round-trips for the
     * rare multi-line cart and avoids per-line lock-acquisition ordering issues as basket
     * size grows.
     */
    private void syncPricesAndValidateStock(List<CartItemEntity> items,
            List<OrderSummaryResponse.PriceChange> priceChanges) {
        // Resolve by varchar PK (product_pk / product_variant_pk): the UUID columns are null for
        // migrated wp-* catalog, which previously made this whole pass skip those lines → no stock
        // validation and (in applyStockForLineItems) no decrement → silent oversell. See V176.
        List<String> productIds = items.stream()
                .filter(item -> item.getProductPk() != null)
                .map(CartItemEntity::getProductPk)
                .distinct()
                .toList();
        if (productIds.isEmpty()) {
            return;
        }
        Map<String, ProductEntity> productsById = productRepo.findAllByIdInForUpdate(productIds).stream()
                .collect(Collectors.toMap(ProductEntity::getId, p -> p));

        List<String> variantIds = items.stream()
                .filter(item -> item.getProductPk() != null && item.getProductVariantPk() != null)
                .map(CartItemEntity::getProductVariantPk)
                .distinct()
                .toList();
        Map<String, ProductVariantEntity> variantsById = variantIds.isEmpty()
                ? Map.of()
                : variantRepo.findAllByIdInForUpdate(variantIds).stream()
                        .collect(Collectors.toMap(ProductVariantEntity::getId, v -> v));

        for (CartItemEntity cartItem : items) {
            if (cartItem.getProductPk() == null) continue;
            ProductEntity product = productsById.get(cartItem.getProductPk());
            if (product == null) {
                throw new ConflictException("Product no longer exists: " + cartItem.getProductName());
            }
            if (product.getPublishStatus() != PublishStatus.PUBLISHED) {
                throw new ConflictException(
                        "Sản phẩm '" + cartItem.getProductName() + "' không còn được bán.");
            }
            ProductVariantEntity variant = null;
            if (cartItem.getProductVariantPk() != null) {
                variant = variantsById.get(cartItem.getProductVariantPk());
                if (variant == null) {
                    throw new ConflictException("Variant no longer exists for: " + cartItem.getProductName());
                }
                if (!variant.isAvailable()) {
                    throw new ConflictException(
                            "Sản phẩm '" + cartItem.getProductName() + "' hết hàng.");
                }
            } else {
                if (product.getStockState() == ProductStockState.OUT_OF_STOCK) {
                    throw new ConflictException(
                            "Sản phẩm '" + cartItem.getProductName() + "' hết hàng.");
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

    private record IdempotencyReservation(UUID reservationId, OrderSummaryResponse existingSummary) {
        private static IdempotencyReservation none() {
            return new IdempotencyReservation(null, null);
        }
    }

    private void runAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}
