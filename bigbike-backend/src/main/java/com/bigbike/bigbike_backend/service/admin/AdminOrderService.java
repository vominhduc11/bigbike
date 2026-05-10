package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderNoteResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.CreateOrderNoteRequest;
import com.bigbike.bigbike_backend.api.admin.dto.order.CreateRefundRequest;
import com.bigbike.bigbike_backend.api.admin.dto.order.OrderAppliedCouponResponse;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminOrderService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private static final Set<String> ALLOWED_ORDER_STATUSES = Set.of(
            "PENDING", "PROCESSING", "ON_HOLD", "COMPLETED", "CANCELLED", "FAILED", "REFUNDED"
    );

    private static final Set<String> ALLOWED_PAYMENT_STATUSES = Set.of(
            "UNPAID", "PENDING", "PAID", "PARTIALLY_PAID", "FAILED", "REFUNDED", "CANCELLED", "PARTIALLY_REFUNDED"
    );

    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS;
    static {
        ALLOWED_TRANSITIONS = new HashMap<>();
        ALLOWED_TRANSITIONS.put("PENDING",    Set.of("PROCESSING", "ON_HOLD", "CANCELLED", "FAILED"));
        ALLOWED_TRANSITIONS.put("ON_HOLD",    Set.of("PROCESSING", "CANCELLED", "FAILED"));
        ALLOWED_TRANSITIONS.put("PROCESSING", Set.of("COMPLETED", "CANCELLED", "FAILED"));
        ALLOWED_TRANSITIONS.put("COMPLETED",  Set.of("REFUNDED"));
        ALLOWED_TRANSITIONS.put("CANCELLED",  Set.of());
        ALLOWED_TRANSITIONS.put("FAILED",     Set.of());
        ALLOWED_TRANSITIONS.put("REFUNDED",   Set.of());
    }

    private static final Map<String, Set<String>> ALLOWED_PAYMENT_TRANSITIONS;
    static {
        ALLOWED_PAYMENT_TRANSITIONS = new HashMap<>();
        ALLOWED_PAYMENT_TRANSITIONS.put("UNPAID",             Set.of("PENDING", "PAID", "PARTIALLY_PAID", "CANCELLED", "FAILED"));
        ALLOWED_PAYMENT_TRANSITIONS.put("PENDING",            Set.of("PAID", "PARTIALLY_PAID", "CANCELLED", "FAILED"));
        ALLOWED_PAYMENT_TRANSITIONS.put("PAID",               Set.of("PARTIALLY_REFUNDED", "REFUNDED", "UNPAID"));
        ALLOWED_PAYMENT_TRANSITIONS.put("PARTIALLY_PAID",     Set.of("PAID", "PARTIALLY_REFUNDED", "REFUNDED", "CANCELLED", "FAILED"));
        ALLOWED_PAYMENT_TRANSITIONS.put("PARTIALLY_REFUNDED", Set.of("REFUNDED"));
        ALLOWED_PAYMENT_TRANSITIONS.put("REFUNDED",           Set.of());
        ALLOWED_PAYMENT_TRANSITIONS.put("CANCELLED",          Set.of());
        ALLOWED_PAYMENT_TRANSITIONS.put("FAILED",             Set.of("PAID", "PARTIALLY_PAID", "CANCELLED"));
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

    public AdminOrderService(
            OrderJpaRepository orderRepo,
            OrderLineItemJpaRepository lineItemRepo,
            OrderAddressJpaRepository addressRepo,
            OrderShippingItemJpaRepository shippingItemRepo,
            OrderNoteJpaRepository noteRepo,
            PaymentJpaRepository paymentRepo,
            OrderAppliedCouponJpaRepository appliedCouponRepo,
            AuditLogJpaRepository auditLogRepo,
            OrderNotificationService orderNotificationService,
            AdminOrderWsService adminOrderWsService,
            com.bigbike.bigbike_backend.service.payment.RefundService refundService,
            OrderStockRestoreService orderStockRestoreService,
            SerialLifecycleService serialLifecycleService
    ) {
        this.orderRepo = orderRepo;
        this.lineItemRepo = lineItemRepo;
        this.addressRepo = addressRepo;
        this.shippingItemRepo = shippingItemRepo;
        this.noteRepo = noteRepo;
        this.paymentRepo = paymentRepo;
        this.appliedCouponRepo = appliedCouponRepo;
        this.auditLogRepo = auditLogRepo;
        this.orderNotificationService = orderNotificationService;
        this.adminOrderWsService = adminOrderWsService;
        this.refundService = refundService;
        this.orderStockRestoreService = orderStockRestoreService;
        this.serialLifecycleService = serialLifecycleService;
    }

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
        return allowed.stream().sorted().toList();
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

        // Transition validation
        Set<String> allowed = ALLOWED_TRANSITIONS.getOrDefault(currentStatus, Set.of());
        if (!allowed.contains(newStatus)) {
            throw new ConflictException(
                    "Cannot transition order from " + currentStatus + " to " + newStatus + ".");
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
        orderRepo.save(order);

        // Serial lifecycle transitions (idempotent; no-op if no serials linked)
        if ("COMPLETED".equals(newStatus)) {
            serialLifecycleService.markSoldForOrder(orderId);
        } else if ("CANCELLED".equals(newStatus)) {
            // Release serial reservations, then restore non-serial stock
            serialLifecycleService.releaseReservationForOrder(orderId, "ORDER_CANCELLED");
            orderStockRestoreService.restoreForCancel(orderId);
        } else if ("REFUNDED".equals(newStatus)) {
            // Refund does not return physical goods — serial stays SOLD until a return is processed
            orderStockRestoreService.restoreForRefund(orderId);
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
                // Mark payment record SUCCEEDED
                paymentRepo.findByOrderId(orderId).stream().findFirst().ifPresent(p -> {
                    p.setStatus("SUCCEEDED");
                    p.setPaidAt(now);
                    paymentRepo.save(p);
                });
            }
            case "PARTIALLY_PAID" -> {
                if (req.paidAmount() == null || req.paidAmount().compareTo(BigDecimal.ZERO) <= 0
                        || req.paidAmount().compareTo(order.getTotalAmount()) >= 0) {
                    throw ValidationException.fromField("paidAmount", "INVALID",
                            "paidAmount must be > 0 and < totalAmount for PARTIALLY_PAID.");
                }
                order.setPaymentStatus("PARTIALLY_PAID");
                order.setPaidAmount(req.paidAmount().setScale(2, RoundingMode.HALF_UP));
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

    // ── Mapping ───────────────────────────────────────────────────────────────

    private Map<UUID, Long> batchCountLineItems(List<UUID> orderIds) {
        if (orderIds.isEmpty()) return Map.of();
        Map<UUID, Long> result = new HashMap<>();
        lineItemRepo.countByOrderIdIn(orderIds)
                .forEach(row -> result.put((UUID) row[0], (Long) row[1]));
        return result;
    }

    private AdminOrderListItemResponse toListItem(OrderEntity order, long itemCount) {
        return new AdminOrderListItemResponse(
                order.getId(),
                order.getOrderNumber(),
                order.getStatus(),
                order.getPaymentStatus(),
                order.getCustomerEmail(),
                order.getCustomerPhone(),
                order.getTotalAmount(),
                order.getCurrency(),
                order.getPlacedAt(),
                (int) itemCount
        );
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
        return new OrderLineItemResponse(e.getId(), e.getProductId(), e.getProductVariantId(),
                e.getSku(), e.getProductName(), e.getVariantName(), e.getQuantity(),
                e.getUnitPrice(), e.getLineSubtotal(), e.getLineDiscount(), e.getLineTotal());
    }

    private OrderAddressResponse toAddress(OrderAddressEntity e) {
        return new OrderAddressResponse(e.getType(), e.getFullName(), e.getEmail(), e.getPhone(),
                e.getCountry(), e.getProvince(), e.getDistrict(), e.getWard(),
                e.getAddressLine1(), e.getAddressLine2());
    }

    private OrderShippingItemResponse toShippingItem(OrderShippingItemEntity e) {
        return new OrderShippingItemResponse(e.getId(), e.getMethodCode(), e.getMethodTitle(), e.getAmount());
    }

    private OrderPaymentResponse toPayment(PaymentEntity e) {
        return new OrderPaymentResponse(e.getId(), e.getPaymentMethod(), e.getStatus(),
                e.getAmount(), e.getCurrency(), e.getPaidAt());
    }

    private AdminOrderNoteResponse toAdminNote(OrderNoteEntity e) {
        return new AdminOrderNoteResponse(e.getId(), e.getAuthorType(), e.getAuthorId(),
                e.getNoteType(), e.getContent(), e.isCustomerVisible(), e.getCreatedAt());
    }

    private OrderAppliedCouponResponse toAppliedCoupon(OrderAppliedCouponEntity e) {
        return new OrderAppliedCouponResponse(e.getId(), e.getCouponId(), e.getCode(), e.getDiscountAmount());
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
