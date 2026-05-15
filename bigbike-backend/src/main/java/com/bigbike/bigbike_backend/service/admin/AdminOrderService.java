package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderNoteResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.CreateOrderNoteRequest;
import com.bigbike.bigbike_backend.api.admin.dto.order.CreateRefundRequest;
import com.bigbike.bigbike_backend.api.admin.dto.order.OrderAppliedCouponResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.UpdateFulfillmentRequest;
import com.bigbike.bigbike_backend.api.admin.dto.order.UpdateOrderStatusRequest;
import com.bigbike.bigbike_backend.api.admin.dto.order.UpdatePaymentStatusRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.api.order.dto.OrderAddressResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderLineItemResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderPaymentResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderShippingItemResponse;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.mapper.OrderAddressMapper;
import com.bigbike.bigbike_backend.mapper.OrderAppliedCouponMapper;
import com.bigbike.bigbike_backend.mapper.OrderItemMapper;
import com.bigbike.bigbike_backend.mapper.OrderMapper;
import com.bigbike.bigbike_backend.mapper.OrderNoteMapper;
import com.bigbike.bigbike_backend.mapper.PaymentMapper;
import com.bigbike.bigbike_backend.mapper.ShippingMapper;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAddressEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAppliedCouponEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderNoteEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderShippingItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderAppliedCouponJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderNoteJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderShippingItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import com.bigbike.bigbike_backend.service.checkout.OrderNotificationService;
import com.bigbike.bigbike_backend.service.inventory.OrderStockRestoreService;
import com.bigbike.bigbike_backend.service.inventory.SerialLifecycleService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.ws.AdminOrderWsService;
import com.bigbike.bigbike_backend.service.ws.OrderWsEvent;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminOrderService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private static final Set<String> ALLOWED_ORDER_STATUSES = Set.of(
            "PENDING", "PROCESSING", "ON_HOLD", "COMPLETED", "CANCELLED", "FAILED", "REFUNDED"
    );

    private static final Set<String> ALLOWED_PAYMENT_STATUSES = Set.of(
            "UNPAID", "PAID", "REFUNDED", "CANCELLED"
    );

    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS;
    static {
        ALLOWED_TRANSITIONS = new HashMap<>();
        ALLOWED_TRANSITIONS.put("PENDING",    Set.of("PROCESSING", "ON_HOLD", "CANCELLED", "FAILED"));
        ALLOWED_TRANSITIONS.put("ON_HOLD",    Set.of("PROCESSING", "CANCELLED", "FAILED"));
        ALLOWED_TRANSITIONS.put("PROCESSING", Set.of("COMPLETED", "CANCELLED", "FAILED"));
        // COMPLETED → REFUNDED is intentionally NOT allowed via direct status patch.
        // Refunds must go through POST /admin/orders/{id}/refund → RefundService.applyRefund,
        // which writes the refund_transaction, payment.refundAmount, voids warranty,
        // restores SOLD serials, writes off open receivable, and flips status to REFUNDED
        // atomically. Patching status directly would skip every one of those steps.
        ALLOWED_TRANSITIONS.put("COMPLETED",  Set.of());
        ALLOWED_TRANSITIONS.put("CANCELLED",  Set.of());
        ALLOWED_TRANSITIONS.put("FAILED",     Set.of());
        ALLOWED_TRANSITIONS.put("REFUNDED",   Set.of());
    }

    private static final Map<String, Set<String>> ALLOWED_PAYMENT_TRANSITIONS;
    static {
        ALLOWED_PAYMENT_TRANSITIONS = new HashMap<>();
        ALLOWED_PAYMENT_TRANSITIONS.put("UNPAID",    Set.of("PAID", "CANCELLED"));
        ALLOWED_PAYMENT_TRANSITIONS.put("PAID",      Set.of("REFUNDED", "UNPAID"));
        ALLOWED_PAYMENT_TRANSITIONS.put("REFUNDED",  Set.of());
        ALLOWED_PAYMENT_TRANSITIONS.put("CANCELLED", Set.of());
    }

    private static final Set<String> ALLOWED_FULFILLMENT_STATUSES = Set.of(
            "UNFULFILLED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"
    );

    private static final Map<String, Set<String>> ALLOWED_FULFILLMENT_TRANSITIONS;
    static {
        ALLOWED_FULFILLMENT_TRANSITIONS = new HashMap<>();
        ALLOWED_FULFILLMENT_TRANSITIONS.put("UNFULFILLED", Set.of("PROCESSING", "DELIVERED", "CANCELLED"));
        ALLOWED_FULFILLMENT_TRANSITIONS.put("PROCESSING",  Set.of("SHIPPED", "CANCELLED"));
        ALLOWED_FULFILLMENT_TRANSITIONS.put("SHIPPED",     Set.of("DELIVERED", "RETURNED"));
        ALLOWED_FULFILLMENT_TRANSITIONS.put("DELIVERED",   Set.of("RETURNED"));
        ALLOWED_FULFILLMENT_TRANSITIONS.put("CANCELLED",   Set.of());
        ALLOWED_FULFILLMENT_TRANSITIONS.put("RETURNED",    Set.of());
    }

    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final OrderAddressJpaRepository addressRepo;
    private final OrderShippingItemJpaRepository shippingItemRepo;
    private final OrderNoteJpaRepository noteRepo;
    private final PaymentJpaRepository paymentRepo;
    private final OrderAppliedCouponJpaRepository appliedCouponRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final OrderNotificationService orderNotificationService;
    private final AdminOrderWsService adminOrderWsService;
    private final com.bigbike.bigbike_backend.service.payment.RefundService refundService;
    private final OrderStockRestoreService orderStockRestoreService;
    private final SerialLifecycleService serialLifecycleService;
    private final OrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;
    private final OrderAddressMapper orderAddressMapper;
    private final ShippingMapper shippingMapper;
    private final PaymentMapper paymentMapper;
    private final OrderNoteMapper orderNoteMapper;
    private final OrderAppliedCouponMapper orderAppliedCouponMapper;

    // ── List ──────────────────────────────────────────────────────────────────

    public PageResult<AdminOrderListItemResponse> listOrders(
            int page, int size, String status, String paymentStatus, String q, String from, String to, String sort
    ) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        Instant fromInstant = parseFromDate(from);
        Instant toInstant = parseToDate(to);

        Specification<OrderEntity> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), status.toUpperCase(Locale.ROOT)));
            }
            if (paymentStatus != null && !paymentStatus.isBlank()) {
                predicates.add(cb.equal(root.get("paymentStatus"), paymentStatus.toUpperCase(Locale.ROOT)));
            }
            if (q != null && !q.isBlank()) {
                String pattern = "%" + q.toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("orderNumber")), pattern),
                        cb.like(cb.lower(root.get("orderKey")), pattern),
                        cb.like(cb.lower(root.get("customerEmail")), pattern),
                        cb.like(cb.lower(root.get("customerPhone")), pattern)
                ));
            }
            if (fromInstant != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("placedAt"), fromInstant));
            }
            if (toInstant != null) {
                predicates.add(cb.lessThan(root.get("placedAt"), toInstant));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        PageRequest pageable = PageRequest.of(
                normalizedPage - 1, normalizedSize,
                resolveSort(sort)
        );

        Page<OrderEntity> orderPage = orderRepo.findAll(spec, pageable);
        List<UUID> orderIds = orderPage.getContent().stream().map(OrderEntity::getId).toList();
        Map<UUID, Long> itemCountMap = batchCountLineItems(orderIds);
        List<AdminOrderListItemResponse> items = orderPage.getContent()
                .stream()
                .map(o -> toListItem(o, itemCountMap.getOrDefault(o.getId(), 0L)))
                .toList();

        return new PageResult<>(items, normalizedPage, normalizedSize,
                orderPage.getTotalElements(), orderPage.getTotalPages());
    }

    // ── Detail ────────────────────────────────────────────────────────────────

    public AdminOrderDetailResponse getOrderDetail(UUID orderId) {
        OrderEntity order = orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found."));
        return toDetail(order);
    }

    /**
     * Returns the list of order statuses that the given order can legally
     * transition into, in a stable order. Used by the admin UI to hide
     * transition buttons that would fail the ConflictException check in
     * {@link #updateOrderStatus}.
     */
    public List<String> listAllowedTransitions(UUID orderId) {
        OrderEntity order = orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found."));
        Set<String> allowed = ALLOWED_TRANSITIONS.getOrDefault(order.getStatus(), Set.of());
        String paymentStatus = order.getPaymentStatus();
        boolean hasMoney = "PAID".equals(paymentStatus) || "PARTIALLY_PAID".equals(paymentStatus);
        return allowed.stream()
                .filter(s -> !(hasMoney && "CANCELLED".equals(s)))
                .sorted()
                .toList();
    }

    // ── Update order status ───────────────────────────────────────────────────

    @Transactional
    public AdminOrderDetailResponse updateOrderStatus(UUID orderId, UUID adminId, UpdateOrderStatusRequest req,
            String clientIp, String userAgent) {
        String newStatus = req.status().toUpperCase(Locale.ROOT);
        if (!ALLOWED_ORDER_STATUSES.contains(newStatus)) {
            throw ValidationException.fromField("status", "INVALID", "Unknown order status: " + newStatus);
        }

        OrderEntity order = orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found."));

        String currentStatus = order.getStatus();

        // Idempotent: same status → return current state, no write
        if (currentStatus.equals(newStatus)) {
            return toDetail(order);
        }

        // Transition validation (structural — map only). Business preconditions
        // (payment/fulfillment guards) are evaluated below per target status.
        Set<String> allowed = ALLOWED_TRANSITIONS.getOrDefault(currentStatus, Set.of());
        if (!allowed.contains(newStatus)) {
            throw new ConflictException(
                    "Cannot transition order from " + currentStatus + " to " + newStatus + ".");
        }

        // Business preconditions: payment / fulfillment must be in the right shape.
        // Keep these as small, target-status–scoped guards so the side-effect path below
        // can stay focused on the actual transition.
        if ("COMPLETED".equals(newStatus)) {
            validateBeforeComplete(order);
        } else if ("CANCELLED".equals(newStatus)) {
            validateBeforeCancel(order);
        }

        String beforeStatus = order.getStatus();
        Instant now = Instant.now();

        order.setStatus(newStatus);
        order.setUpdatedAt(now);
        if ("COMPLETED".equals(newStatus) && order.getCompletedAt() == null) {
            order.setCompletedAt(now);
        }
        if ("CANCELLED".equals(newStatus) && order.getCancelledAt() == null) {
            order.setCancelledAt(now);
        }

        // Auto-initialise fulfillmentStatus for DELIVERY orders on key transitions.
        if ("DELIVERY".equalsIgnoreCase(order.getFulfillmentType())) {
            if ("PROCESSING".equals(newStatus) && order.getFulfillmentStatus() == null) {
                order.setFulfillmentStatus("UNFULFILLED");
            } else if ("CANCELLED".equals(newStatus)) {
                order.setFulfillmentStatus("CANCELLED");
            }
        }

        // BACS orders move ON_HOLD → PROCESSING only after admin confirms payment received.
        // Auto-mark payment PAID so admin does not need a separate step.
        if ("PROCESSING".equals(newStatus)
                && "ON_HOLD".equals(currentStatus)
                && "BACS".equalsIgnoreCase(order.getPaymentMethod())
                && "UNPAID".equals(order.getPaymentStatus())) {
            order.setPaymentStatus("PAID");
            if (order.getPaidAmount() == null
                    || order.getPaidAmount().compareTo(BigDecimal.ZERO) == 0) {
                order.setPaidAmount(order.getTotalAmount());
            }
            if (order.getPaidAt() == null) order.setPaidAt(now);
            paymentRepo.findByOrderId(orderId).stream().findFirst().ifPresent(p -> {
                p.setStatus("SUCCEEDED");
                p.setPaidAt(now);
                paymentRepo.save(p);
            });
        }

        orderRepo.save(order);

        // Serial lifecycle transitions (idempotent; no-op if no serials linked).
        // REFUNDED is unreachable here — ALLOWED_TRANSITIONS blocks it, refunds go through RefundService.
        if ("COMPLETED".equals(newStatus)) {
            serialLifecycleService.markSoldForOrder(orderId);
        } else if ("CANCELLED".equals(newStatus)) {
            // Release serial reservations, then restore non-serial stock
            serialLifecycleService.releaseReservationForOrder(orderId, "ORDER_CANCELLED");
            orderStockRestoreService.restoreForCancel(orderId);
        }

        // Add note if provided
        if (req.note() != null && !req.note().isBlank()) {
            boolean visible = Boolean.TRUE.equals(req.customerVisible());
            noteRepo.save(buildNote(order, adminId, "ADMIN", req.note(), visible, now));
        }

        // Audit log
        auditLogRepo.save(buildAudit(adminId, "ORDER_STATUS_UPDATED", "ORDER", order.getId(),
                "{\"status\":\"" + beforeStatus + "\"}",
                "{\"status\":\"" + newStatus + "\"}", now, clientIp, userAgent));

        // Email customer when status is customer-visible
        String customerNote = (req.note() != null && Boolean.TRUE.equals(req.customerVisible()))
                ? req.note() : null;
        orderNotificationService.sendOrderStatusUpdate(order, newStatus, customerNote);
        adminOrderWsService.pushEvent(buildStatusChangedEvent(order, newStatus));

        return toDetail(orderRepo.findById(orderId).orElseThrow());
    }

    // ── Update payment status ─────────────────────────────────────────────────

    @Transactional
    public AdminOrderDetailResponse updatePaymentStatus(UUID orderId, UUID adminId, UpdatePaymentStatusRequest req,
            String clientIp, String userAgent) {
        String newPaymentStatus = req.paymentStatus().toUpperCase(Locale.ROOT);
        if (!ALLOWED_PAYMENT_STATUSES.contains(newPaymentStatus)) {
            throw ValidationException.fromField("paymentStatus", "INVALID",
                    "Unknown payment status: " + newPaymentStatus);
        }

        OrderEntity order = orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found."));

        String orderStatus = order.getStatus();
        if ("CANCELLED".equals(orderStatus) || "FAILED".equals(orderStatus) || "REFUNDED".equals(orderStatus)) {
            throw new ConflictException(
                    "Không thể cập nhật thanh toán cho đơn hàng đã " +
                    ("CANCELLED".equals(orderStatus) ? "hủy" : "FAILED".equals(orderStatus) ? "thất bại" : "hoàn tiền") + ".");
        }

        String currentPaymentStatus = order.getPaymentStatus();
        String beforePaymentStatus = currentPaymentStatus;

        if (currentPaymentStatus.equals(newPaymentStatus)) {
            return toDetail(order);
        }

        Set<String> allowedPayment = ALLOWED_PAYMENT_TRANSITIONS.getOrDefault(currentPaymentStatus, Set.of());
        if (!allowedPayment.contains(newPaymentStatus)) {
            throw new ConflictException(
                    "Cannot transition payment from " + currentPaymentStatus + " to " + newPaymentStatus + ".");
        }

        Instant now = Instant.now();

        switch (newPaymentStatus) {
            case "PAID" -> {
                BigDecimal paid = req.paidAmount() != null
                        ? req.paidAmount().setScale(2, RoundingMode.HALF_UP)
                        : order.getTotalAmount();
                order.setPaymentStatus("PAID");
                order.setPaidAmount(paid);
                if (order.getPaidAt() == null) order.setPaidAt(now);
                // Mark payment record SUCCEEDED; capture bank transfer reference if provided
                paymentRepo.findByOrderId(orderId).stream().findFirst().ifPresent(p -> {
                    p.setStatus("SUCCEEDED");
                    p.setPaidAt(now);
                    if (req.bankReference() != null && !req.bankReference().isBlank()) {
                        p.setTransactionId(req.bankReference().strip());
                    }
                    paymentRepo.save(p);
                });
            }
            case "UNPAID" -> {
                if (req.paidAmount() != null && req.paidAmount().compareTo(BigDecimal.ZERO) != 0) {
                    throw ValidationException.fromField("paidAmount", "INVALID",
                            "paidAmount must be 0 for UNPAID.");
                }
                order.setPaymentStatus("UNPAID");
                order.setPaidAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
                order.setPaidAt(null);
            }
            default -> order.setPaymentStatus(newPaymentStatus);
        }

        order.setUpdatedAt(now);
        orderRepo.save(order);

        // Note
        if (req.note() != null && !req.note().isBlank()) {
            boolean visible = Boolean.TRUE.equals(req.customerVisible());
            noteRepo.save(buildNote(order, adminId, "ADMIN", req.note(), visible, now));
        }

        // Audit
        auditLogRepo.save(buildAudit(adminId, "ORDER_PAYMENT_STATUS_UPDATED", "ORDER", order.getId(),
                "{\"paymentStatus\":\"" + beforePaymentStatus + "\"}",
                "{\"paymentStatus\":\"" + newPaymentStatus + "\"}", now, clientIp, userAgent));

        adminOrderWsService.pushEvent(new OrderWsEvent(
                "ORDER_PAYMENT_STATUS_CHANGED", order.getId(), order.getOrderNumber(),
                safeCustomerName(order), order.getTotalAmount(),
                order.getStatus(), newPaymentStatus, now));

        return toDetail(orderRepo.findById(orderId).orElseThrow());
    }

    // ── Create refund ─────────────────────────────────────────────────────────

    @Transactional
    public AdminOrderDetailResponse createRefund(UUID orderId, UUID adminId, CreateRefundRequest req,
            String clientIp, String userAgent) {
        String noteContent = req.note() != null && !req.note().isBlank() ? req.note() : null;
        refundService.applyRefund(
                orderId, adminId,
                req.refundAmount(), req.refundReason(),
                noteContent, Boolean.TRUE.equals(req.customerVisible()),
                clientIp, userAgent);
        return toDetail(orderRepo.findById(orderId).orElseThrow());
    }

    // ── Update fulfillment status ─────────────────────────────────────────────

    @Transactional
    public AdminOrderDetailResponse updateFulfillmentStatus(UUID orderId, UUID adminId,
            UpdateFulfillmentRequest req, String clientIp, String userAgent) {

        String newStatus = req.fulfillmentStatus().toUpperCase(Locale.ROOT);
        if (!ALLOWED_FULFILLMENT_STATUSES.contains(newStatus)) {
            throw ValidationException.fromField("fulfillmentStatus", "INVALID",
                    "Unknown fulfillment status: " + newStatus);
        }

        OrderEntity order = orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found."));

        if (!"DELIVERY".equalsIgnoreCase(order.getFulfillmentType())) {
            throw new ConflictException(
                    "Fulfillment status is only applicable to DELIVERY orders.");
        }

        String current = order.getFulfillmentStatus();

        if (newStatus.equals(current)) {
            return toDetail(order);
        }

        if (current != null) {
            Set<String> allowed = ALLOWED_FULFILLMENT_TRANSITIONS.getOrDefault(current, Set.of());
            if (!allowed.contains(newStatus)) {
                throw new ConflictException(
                        "Cannot transition fulfillment from " + current + " to " + newStatus + ".");
            }
        }

        Instant now = Instant.now();

        order.setFulfillmentStatus(newStatus);
        order.setUpdatedAt(now);

        if ("SHIPPED".equals(newStatus) && order.getShippedAt() == null) {
            order.setShippedAt(now);
        }
        if (req.trackingNumber() != null && !req.trackingNumber().isBlank()) {
            order.setTrackingNumber(req.trackingNumber().trim());
        }
        if (req.shippingCarrier() != null && !req.shippingCarrier().isBlank()) {
            order.setShippingCarrier(req.shippingCarrier().trim());
        }

        orderRepo.save(order);

        if (req.note() != null && !req.note().isBlank()) {
            boolean visible = Boolean.TRUE.equals(req.customerVisible());
            noteRepo.save(buildNote(order, adminId, "ADMIN", req.note(), visible, now));
        }

        auditLogRepo.save(buildAudit(adminId, "ORDER_FULFILLMENT_STATUS_UPDATED", "ORDER",
                order.getId(),
                "{\"fulfillmentStatus\":\"" + current + "\"}",
                "{\"fulfillmentStatus\":\"" + newStatus + "\""
                        + (order.getTrackingNumber() != null
                                ? ",\"trackingNumber\":\"" + order.getTrackingNumber() + "\""
                                : "") + "}",
                now, clientIp, userAgent));

        if ("SHIPPED".equals(newStatus)) {
            String customerNote = (req.note() != null && Boolean.TRUE.equals(req.customerVisible()))
                    ? req.note() : null;
            orderNotificationService.sendOrderShipped(order, customerNote);
        }

        adminOrderWsService.pushEvent(new OrderWsEvent(
                "ORDER_FULFILLMENT_STATUS_CHANGED", order.getId(), order.getOrderNumber(),
                safeCustomerName(order), order.getTotalAmount(),
                order.getStatus(), order.getPaymentStatus(), now));

        return toDetail(orderRepo.findById(orderId).orElseThrow());
    }

    // ── Add note ──────────────────────────────────────────────────────────────

    @Transactional
    public AdminOrderNoteResponse addNote(UUID orderId, UUID adminId, CreateOrderNoteRequest req,
            String clientIp, String userAgent) {
        OrderEntity order = orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found."));

        Instant now = Instant.now();
        String noteType = (req.noteType() != null && !req.noteType().isBlank()) ? req.noteType() : "ADMIN";
        boolean visible = Boolean.TRUE.equals(req.customerVisible());

        OrderNoteEntity note = buildNote(order, adminId, noteType, req.content(), visible, now);
        note = noteRepo.save(note);

        auditLogRepo.save(buildAudit(adminId, "ORDER_NOTE_CREATED", "ORDER", orderId,
                null,
                "{\"noteType\":\"" + noteType + "\",\"customerVisible\":" + visible + "}", now,
                clientIp, userAgent));

        adminOrderWsService.pushEvent(new OrderWsEvent(
                "ORDER_NOTE_ADDED", order.getId(), order.getOrderNumber(),
                safeCustomerName(order), order.getTotalAmount(),
                order.getStatus(), order.getPaymentStatus(), now));

        return toAdminNote(note);
    }

    // ── List notes ────────────────────────────────────────────────────────────

    public List<AdminOrderNoteResponse> listNotes(UUID orderId) {
        if (!orderRepo.existsById(orderId)) {
            throw new NotFoundException("Order not found.");
        }
        return noteRepo.findByOrderIdOrderByCreatedAtAsc(orderId)
                .stream().map(this::toAdminNote).toList();
    }

    // ── Business preconditions for status transitions ─────────────────────────

    /**
     * Enforce business rules before flipping an order to COMPLETED.
     *
     * Rule 3 — DELIVERY orders cannot be COMPLETED until the goods have been
     * marked DELIVERED. fulfillmentStatus is initialised to UNFULFILLED on
     * order creation and progresses UNFULFILLED → PROCESSING → SHIPPED →
     * DELIVERED via {@link #updateFulfillmentStatus}.
     *
     * Rule 2 — COD orders must have collected the cash before completion;
     * "complete" means goods + money, not just goods.
     *
     * Rule 1 — COMPLETED + UNPAID is only legitimate for credit/receivable orders
     * (POS CREDIT, walk-in công nợ). Anything else leaves money on the table
     * with no receivable to chase it.
     *
     * POS in-store orders (fulfillmentType = IN_STORE) intentionally skip the
     * DELIVERY guard — the goods change hands at the counter when the order
     * is created.
     */
    private void validateBeforeComplete(OrderEntity order) {
        String fulfillmentType = order.getFulfillmentType();
        String fulfillmentStatus = order.getFulfillmentStatus();
        String paymentMethod = order.getPaymentMethod();
        String paymentStatus = order.getPaymentStatus();

        if ("DELIVERY".equalsIgnoreCase(fulfillmentType)
                && !"DELIVERED".equals(fulfillmentStatus)) {
            throw new ConflictException(
                    "Chỉ được hoàn thành đơn giao hàng sau khi đã giao thành công.");
        }

        if ("COD".equalsIgnoreCase(paymentMethod) && !"PAID".equals(paymentStatus)) {
            throw new ConflictException(
                    "Đơn COD phải được thu tiền trước khi hoàn thành.");
        }

        if ("UNPAID".equals(paymentStatus)) {
            boolean isCreditOrder = "CREDIT".equalsIgnoreCase(paymentMethod);
            boolean hasCustomer = order.getCustomerId() != null;
            if (!isCreditOrder || !hasCustomer) {
                throw new ConflictException(
                        "Đơn chưa thanh toán chỉ được hoàn thành khi là đơn công nợ có khách hàng hợp lệ.");
            }
        }
    }

    /**
     * Reject direct cancel when the order already has money attached.
     *
     * Rule 4 — PAID orders must go through the refund flow
     * ({@link com.bigbike.bigbike_backend.service.payment.RefundService})
     * so the payment record, receivable, audit log, and stock/serial lifecycle
     * stay consistent. A direct CANCELLED patch would skip every one of those
     * steps and leave the books out of sync. UNPAID orders cancel cleanly.
     */
    private void validateBeforeCancel(OrderEntity order) {
        String paymentStatus = order.getPaymentStatus();
        if ("PAID".equals(paymentStatus)) {
            throw new ConflictException(
                    "Đơn đã có thanh toán, cần xử lý hoàn tiền trước khi hủy.");
        }
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private Map<UUID, Long> batchCountLineItems(List<UUID> orderIds) {
        if (orderIds.isEmpty()) return Map.of();
        Map<UUID, Long> result = new HashMap<>();
        lineItemRepo.countByOrderIdIn(orderIds)
                .forEach(row -> result.put((UUID) row[0], (Long) row[1]));
        return result;
    }

    private AdminOrderListItemResponse toListItem(OrderEntity order, long itemCount) {
        return orderMapper.toAdminListItem(order, (int) itemCount);
    }

    private AdminOrderDetailResponse toDetail(OrderEntity order) {
        List<OrderLineItemResponse> lineItems = lineItemRepo.findByOrderId(order.getId())
                .stream().map(this::toLineItem).toList();

        List<OrderAddressResponse> addresses = addressRepo.findByOrderId(order.getId())
                .stream().map(this::toAddress).toList();

        List<OrderShippingItemResponse> shippingItems = shippingItemRepo.findByOrderId(order.getId())
                .stream().map(this::toShippingItem).toList();

        List<OrderPaymentResponse> payments = paymentRepo.findByOrderId(order.getId())
                .stream().map(this::toPayment).toList();

        // Admin sees ALL notes (customerVisible=true AND false)
        List<AdminOrderNoteResponse> notes = noteRepo.findByOrderIdOrderByCreatedAtAsc(order.getId())
                .stream().map(this::toAdminNote).toList();

        List<OrderAppliedCouponResponse> appliedCoupons = appliedCouponRepo.findByOrderId(order.getId())
                .stream().map(this::toAppliedCoupon).toList();

        return new AdminOrderDetailResponse(
                order.getId(),
                order.getOrderNumber(),
                order.getOrderKey(),
                order.getStatus(),
                order.getPaymentStatus(),
                order.getFulfillmentStatus(),
                order.getFulfillmentType(),
                order.getTrackingNumber(),
                order.getShippingCarrier(),
                order.getShippedAt(),
                order.getCustomerEmail(),
                order.getCustomerPhone(),
                order.getCustomerNote(),
                order.getCurrency(),
                order.getSource(),
                order.getSubtotalAmount(),
                order.getDiscountAmount(),
                order.getShippingAmount(),
                order.getFeeAmount(),
                order.getTaxAmount(),
                order.getTotalAmount(),
                order.getPaidAmount(),
                order.getRefundAmount(),
                order.getRefundReason(),
                order.getPlacedAt(),
                order.getPaidAt(),
                order.getCompletedAt(),
                order.getCancelledAt(),
                order.getRefundedAt(),
                lineItems,
                addresses,
                shippingItems,
                payments,
                notes,
                appliedCoupons
        );
    }

    private OrderLineItemResponse toLineItem(OrderLineItemEntity e) {
        return orderItemMapper.toResponse(e);
    }

    private OrderAddressResponse toAddress(OrderAddressEntity e) {
        return orderAddressMapper.toResponse(e);
    }

    private OrderShippingItemResponse toShippingItem(OrderShippingItemEntity e) {
        return shippingMapper.toResponse(e);
    }

    private OrderPaymentResponse toPayment(PaymentEntity e) {
        return paymentMapper.toResponse(e);
    }

    private AdminOrderNoteResponse toAdminNote(OrderNoteEntity e) {
        return orderNoteMapper.toAdminResponse(e);
    }

    private OrderAppliedCouponResponse toAppliedCoupon(OrderAppliedCouponEntity e) {
        return orderAppliedCouponMapper.toResponse(e);
    }

    // ── Build helpers ─────────────────────────────────────────────────────────

    private static String safeCustomerName(OrderEntity order) {
        if (order.getCustomerEmail() != null && !order.getCustomerEmail().isBlank()) {
            return order.getCustomerEmail();
        }
        if (order.getCustomerPhone() != null && !order.getCustomerPhone().isBlank()) {
            return order.getCustomerPhone();
        }
        return "Khách hàng";
    }

    private OrderNoteEntity buildNote(OrderEntity order, UUID adminId, String noteType,
            String content, boolean customerVisible, Instant now) {
        OrderNoteEntity note = new OrderNoteEntity();
        note.setOrder(order);
        note.setAuthorType("ADMIN");
        note.setAuthorId(adminId);
        note.setNoteType(noteType);
        note.setContent(content);
        note.setCustomerVisible(customerVisible);
        note.setCreatedAt(now);
        return note;
    }

    private AuditLogEntity buildAudit(UUID adminId, String action, String resourceType,
            UUID resourceId, String before, String after, Instant now, String clientIp, String userAgent) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(adminId);
        log.setAction(action);
        log.setResourceType(resourceType);
        log.setResourceId(resourceId);
        log.setBeforeData(before);
        log.setAfterData(after);
        log.setIpAddress(clientIp);
        log.setUserAgent(userAgent);
        log.setCreatedAt(now);
        return log;
    }

    // ── Date parsing helpers ──────────────────────────────────────────────────

    private static Instant parseFromDate(String date) {
        if (date == null || date.isBlank()) return null;
        try {
            return LocalDate.parse(date).atStartOfDay(ZoneOffset.UTC).toInstant();
        } catch (Exception e) { return null; }
    }

    private static Instant parseToDate(String date) {
        if (date == null || date.isBlank()) return null;
        try {
            return LocalDate.parse(date).plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        } catch (Exception e) { return null; }
    }

    private static Sort resolveSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Order.desc("placedAt").nullsLast(), Sort.Order.desc("createdAt"));
        }
        String[] parts = sort.split(":", 2);
        String field = parts[0].trim();
        boolean desc = parts.length < 2 || !"asc".equalsIgnoreCase(parts[1].trim());
        Sort.Order order = switch (field) {
            case "total", "totalAmount" -> desc
                    ? Sort.Order.desc("totalAmount")
                    : Sort.Order.asc("totalAmount");
            case "createdAt", "placedAt" -> desc
                    ? Sort.Order.desc("placedAt").nullsLast()
                    : Sort.Order.asc("placedAt").nullsLast();
            default -> Sort.Order.desc("placedAt").nullsLast();
        };
        return Sort.by(order, Sort.Order.desc("createdAt"));
    }

    private static OrderWsEvent buildStatusChangedEvent(OrderEntity order, String newStatus) {
        String customerName = order.getCustomerEmail() != null && !order.getCustomerEmail().isBlank()
                ? order.getCustomerEmail()
                : (order.getCustomerPhone() != null ? order.getCustomerPhone() : "Khách hàng");
        return new OrderWsEvent(
                "ORDER_STATUS_CHANGED",
                order.getId(),
                order.getOrderNumber(),
                customerName,
                order.getTotalAmount(),
                newStatus,
                order.getPaymentStatus(),
                Instant.now()
        );
    }
}
