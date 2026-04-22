package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderNoteResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.CreateOrderNoteRequest;
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
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderNoteEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderShippingItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderNoteJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderShippingItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
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
            "UNPAID", "PENDING", "PAID", "PARTIALLY_PAID", "FAILED", "REFUNDED", "CANCELLED"
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

    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final OrderAddressJpaRepository addressRepo;
    private final OrderShippingItemJpaRepository shippingItemRepo;
    private final OrderNoteJpaRepository noteRepo;
    private final PaymentJpaRepository paymentRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final PaginationService paginationService;

    public AdminOrderService(
            OrderJpaRepository orderRepo,
            OrderLineItemJpaRepository lineItemRepo,
            OrderAddressJpaRepository addressRepo,
            OrderShippingItemJpaRepository shippingItemRepo,
            OrderNoteJpaRepository noteRepo,
            PaymentJpaRepository paymentRepo,
            AuditLogJpaRepository auditLogRepo,
            PaginationService paginationService
    ) {
        this.orderRepo = orderRepo;
        this.lineItemRepo = lineItemRepo;
        this.addressRepo = addressRepo;
        this.shippingItemRepo = shippingItemRepo;
        this.noteRepo = noteRepo;
        this.paymentRepo = paymentRepo;
        this.auditLogRepo = auditLogRepo;
        this.paginationService = paginationService;
    }

    // ── List ──────────────────────────────────────────────────────────────────

    public PageResult<AdminOrderListItemResponse> listOrders(
            int page, int size, String status, String paymentStatus, String q, String from, String to
    ) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        Instant fromInstant = parseFromDate(from);
        Instant toInstant = parseToDate(to);

        Stream<OrderEntity> stream = orderRepo.findAll().stream();

        if (status != null && !status.isBlank()) {
            stream = stream.filter(o -> status.equalsIgnoreCase(o.getStatus()));
        }
        if (paymentStatus != null && !paymentStatus.isBlank()) {
            stream = stream.filter(o -> paymentStatus.equalsIgnoreCase(o.getPaymentStatus()));
        }
        if (q != null && !q.isBlank()) {
            String qLower = q.toLowerCase(Locale.ROOT);
            stream = stream.filter(o ->
                    matchesQ(o.getOrderNumber(), qLower) ||
                    matchesQ(o.getCustomerEmail(), qLower) ||
                    matchesQ(o.getCustomerPhone(), qLower)
            );
        }
        if (fromInstant != null) {
            stream = stream.filter(o -> o.getPlacedAt() != null && !o.getPlacedAt().isBefore(fromInstant));
        }
        if (toInstant != null) {
            stream = stream.filter(o -> o.getPlacedAt() != null && !o.getPlacedAt().isAfter(toInstant));
        }

        List<AdminOrderListItemResponse> items = stream
                .sorted(Comparator
                        .comparing(OrderEntity::getPlacedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(OrderEntity::getCreatedAt, Comparator.reverseOrder()))
                .map(this::toListItem)
                .toList();

        return paginationService.paginate(items, normalizedPage, normalizedSize);
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
    public AdminOrderDetailResponse updateOrderStatus(UUID orderId, UUID adminId, UpdateOrderStatusRequest req) {
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

        // Add note if provided
        if (req.note() != null && !req.note().isBlank()) {
            boolean visible = Boolean.TRUE.equals(req.customerVisible());
            noteRepo.save(buildNote(order, adminId, "ADMIN", req.note(), visible, now));
        }

        // Audit log
        auditLogRepo.save(buildAudit(adminId, "ORDER_STATUS_UPDATED", "ORDER", order.getId(),
                "{\"status\":\"" + beforeStatus + "\"}",
                "{\"status\":\"" + newStatus + "\"}", now));

        return toDetail(orderRepo.findById(orderId).orElseThrow());
    }

    // ── Update payment status ─────────────────────────────────────────────────

    @Transactional
    public AdminOrderDetailResponse updatePaymentStatus(UUID orderId, UUID adminId, UpdatePaymentStatusRequest req) {
        String newPaymentStatus = req.paymentStatus().toUpperCase(Locale.ROOT);
        if (!ALLOWED_PAYMENT_STATUSES.contains(newPaymentStatus)) {
            throw ValidationException.fromField("paymentStatus", "INVALID",
                    "Unknown payment status: " + newPaymentStatus);
        }

        OrderEntity order = orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found."));

        String beforePaymentStatus = order.getPaymentStatus();
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
                "{\"paymentStatus\":\"" + newPaymentStatus + "\"}", now));

        return toDetail(orderRepo.findById(orderId).orElseThrow());
    }

    // ── Add note ──────────────────────────────────────────────────────────────

    @Transactional
    public AdminOrderNoteResponse addNote(UUID orderId, UUID adminId, CreateOrderNoteRequest req) {
        OrderEntity order = orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found."));

        Instant now = Instant.now();
        String noteType = (req.noteType() != null && !req.noteType().isBlank()) ? req.noteType() : "ADMIN";
        boolean visible = Boolean.TRUE.equals(req.customerVisible());

        OrderNoteEntity note = buildNote(order, adminId, noteType, req.content(), visible, now);
        note = noteRepo.save(note);

        auditLogRepo.save(buildAudit(adminId, "ORDER_NOTE_CREATED", "ORDER", orderId,
                null,
                "{\"noteType\":\"" + noteType + "\",\"customerVisible\":" + visible + "}", now));

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

    private AdminOrderListItemResponse toListItem(OrderEntity order) {
        long itemCount = lineItemRepo.countByOrderId(order.getId());
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
                order.getPlacedAt(),
                order.getPaidAt(),
                order.getCompletedAt(),
                order.getCancelledAt(),
                lineItems,
                addresses,
                shippingItems,
                payments,
                notes
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

    // ── Build helpers ─────────────────────────────────────────────────────────

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
            UUID resourceId, String before, String after, Instant now) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(adminId);
        log.setAction(action);
        log.setResourceType(resourceType);
        log.setResourceId(resourceId);
        log.setBeforeData(before);
        log.setAfterData(after);
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

    private static boolean matchesQ(String field, String qLower) {
        return field != null && field.toLowerCase(Locale.ROOT).contains(qLower);
    }
}
