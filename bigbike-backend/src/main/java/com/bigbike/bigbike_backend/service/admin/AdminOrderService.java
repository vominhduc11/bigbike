package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderNoteResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.OrderAuditLogResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.CreateOrderNoteRequest;
import com.bigbike.bigbike_backend.api.admin.dto.order.UpdateOrderStatusRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.api.order.dto.OrderAddressResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderLineItemResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderPaymentResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderShippingItemResponse;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.mapper.OrderAddressMapper;
import com.bigbike.bigbike_backend.mapper.OrderItemMapper;
import com.bigbike.bigbike_backend.mapper.OrderMapper;
import com.bigbike.bigbike_backend.mapper.OrderNoteMapper;
import com.bigbike.bigbike_backend.mapper.PaymentMapper;
import com.bigbike.bigbike_backend.mapper.ShippingMapper;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAddressEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderNoteEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderShippingItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderNoteJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderShippingItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.checkout.OrderNotificationService;
import com.bigbike.bigbike_backend.service.order.OrderLineItemThumbnailResolver;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.ws.AdminOrderWsService;
import com.bigbike.bigbike_backend.service.ws.OrderWsEvent;
import static com.bigbike.bigbike_backend.service.admin.AdminOrderSupport.buildNote;
import static com.bigbike.bigbike_backend.service.admin.AdminOrderSupport.buildStatusChangedEvent;
import static com.bigbike.bigbike_backend.service.admin.AdminOrderSupport.parseFromDate;
import static com.bigbike.bigbike_backend.service.admin.AdminOrderSupport.parseToDate;
import static com.bigbike.bigbike_backend.service.admin.AdminOrderSupport.resolveSort;
import static com.bigbike.bigbike_backend.service.admin.AdminOrderSupport.safeCustomerName;
import static com.bigbike.bigbike_backend.service.admin.AdminOrderSupport.withResolvedCustomerName;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@RequiredArgsConstructor
public class AdminOrderService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private static final Set<String> ALLOWED_ORDER_STATUSES = Set.of(
            "PENDING", "PROCESSING", "SHIPPING", "COMPLETED", "CANCELLED"
    );


    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS;
    static {
        ALLOWED_TRANSITIONS = new HashMap<>();
        ALLOWED_TRANSITIONS.put("PENDING",    Set.of("PROCESSING", "CANCELLED"));
        ALLOWED_TRANSITIONS.put("PROCESSING", Set.of("SHIPPING", "CANCELLED"));
        ALLOWED_TRANSITIONS.put("SHIPPING",   Set.of("COMPLETED", "CANCELLED"));
        ALLOWED_TRANSITIONS.put("COMPLETED",  Set.of());
        ALLOWED_TRANSITIONS.put("CANCELLED",  Set.of());
    }

    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final OrderAddressJpaRepository addressRepo;
    private final OrderShippingItemJpaRepository shippingItemRepo;
    private final OrderNoteJpaRepository noteRepo;
    private final PaymentJpaRepository paymentRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;
    private final OrderNotificationService orderNotificationService;
    private final AdminOrderWsService adminOrderWsService;
    private final WebRevalidationService webRevalidationService;
    private final OrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;
    private final OrderLineItemThumbnailResolver thumbnailResolver;
    private final OrderAddressMapper orderAddressMapper;
    private final ShippingMapper shippingMapper;
    private final PaymentMapper paymentMapper;
    private final OrderNoteMapper orderNoteMapper;

    // ── List ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageResult<AdminOrderListItemResponse> listOrders(
            int page, int size, String status, String q, String from, String to, String sort
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
        Map<UUID, String> fallbackNameMap = batchShippingNames(orderIds);
        List<AdminOrderListItemResponse> items = orderPage.getContent()
                .stream()
                .map(o -> withResolvedCustomerName(
                        toListItem(o, itemCountMap.getOrDefault(o.getId(), 0L)),
                        fallbackNameMap))
                .toList();

        return new PageResult<>(items, normalizedPage, normalizedSize,
                orderPage.getTotalElements(), orderPage.getTotalPages());
    }

    // ── Detail ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AdminOrderDetailResponse getOrderDetail(UUID orderId) {
        OrderEntity order = orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found."));
        return toDetail(order);
    }

    /** Returns the next legal values in the single order-status state machine. */
    @Transactional(readOnly = true)
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

        // Transition validation is the complete business rule for the single axis.
        Set<String> allowed = ALLOWED_TRANSITIONS.getOrDefault(currentStatus, Set.of());
        if (!allowed.contains(newStatus)) {
            throw new ConflictException(
                    "Cannot transition order from " + currentStatus + " to " + newStatus + ".");
        }

        if ("SHIPPING".equals(newStatus)) {
            if (req.trackingNumber() == null || req.trackingNumber().isBlank()) {
                throw ValidationException.fromField("trackingNumber", "REQUIRED",
                        "Mã vận đơn (trackingNumber) là bắt buộc khi chuyển sang Đang giao.");
            }
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

        if ("SHIPPING".equals(newStatus)) {
            order.setTrackingNumber(req.trackingNumber().trim());
            if (req.shippingCarrier() != null && !req.shippingCarrier().isBlank()) {
                order.setShippingCarrier(req.shippingCarrier().trim());
            }
            if (order.getShippedAt() == null) {
                order.setShippedAt(now);
            }
        }

        orderRepo.save(order);

        // Web cache side-effects.
        if ("COMPLETED".equals(newStatus)) {
            webRevalidationService.revalidateProductsForOrder(orderId);
        } else if ("CANCELLED".equals(newStatus)) {
            // Inventory is boolean availability only (owner decision 2026-06-23) — nothing to
            // restore on cancel. Just refresh the web cache.
            webRevalidationService.revalidateProductsForOrder(orderId);
        }

        // Add note if provided
        if (req.note() != null && !req.note().isBlank()) {
            boolean visible = Boolean.TRUE.equals(req.customerVisible());
            noteRepo.save(buildNote(order, adminId, "ADMIN", req.note(), visible, now));
        }

        // Audit log
        auditLogWriter.save(auditLogFactory.build("ADMIN", adminId, "ORDER_STATUS_UPDATED", "ORDER", order.getId(),
                "{\"status\":\"" + beforeStatus + "\"}",
                "{\"status\":\"" + newStatus + "\"}", clientIp, userAgent));

        // Email customer when status is customer-visible (after commit so DB state is consistent)
        String customerNote = (req.note() != null && Boolean.TRUE.equals(req.customerVisible()))
                ? req.note() : null;
        OrderEntity statusSnapshot = order;
        String statusForEmail = newStatus;
        String noteForEmail = customerNote;
        // pushEvent() already defers its own send until after-commit — call it directly here,
        // not nested inside runAfterCommit below (a TransactionSynchronization registered from
        // inside another synchronization's afterCommit() of the same transaction is silently
        // dropped by Spring, which was swallowing this admin push).
        adminOrderWsService.pushEvent(buildStatusChangedEvent(order, newStatus));
        runAfterCommit(() -> orderNotificationService.sendOrderStatusUpdate(statusSnapshot, statusForEmail, noteForEmail));

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

        auditLogWriter.save(auditLogFactory.build("ADMIN", adminId, "ORDER_NOTE_CREATED", "ORDER", orderId,
                null,
                "{\"noteType\":\"" + noteType + "\",\"customerVisible\":" + visible + "}",
                clientIp, userAgent));

        // pushEvent() defers its own send until after commit.
        adminOrderWsService.pushEvent(new OrderWsEvent(
                "ORDER_NOTE_ADDED", order.getId(), order.getOrderNumber(),
                safeCustomerName(order), order.getTotalAmount(),
                order.getStatus(), order.getPaymentMethod(), now));

        return toAdminNote(note);
    }

    // ── List notes ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AdminOrderNoteResponse> listNotes(UUID orderId) {
        if (!orderRepo.existsById(orderId)) {
            throw new NotFoundException("Order not found.");
        }
        return noteRepo.findByOrderIdOrderByCreatedAtAsc(orderId)
                .stream().map(this::toAdminNote).toList();
    }

    // ── Audit trail ───────────────────────────────────────────────────────────

    /**
     * Read-only audit trail for an order: every status/payment-record/shipping-metadata/note
     * change recorded in {@code audit_logs} (resource_type = ORDER), newest first.
     */
    @Transactional(readOnly = true)
    public List<OrderAuditLogResponse> listAuditTrail(UUID orderId) {
        if (!orderRepo.existsById(orderId)) {
            throw new NotFoundException("Order not found.");
        }
        return auditLogRepo.findByResourceTypeAndResourceId("ORDER", orderId)
                .stream()
                .sorted(Comparator.comparing(AuditLogEntity::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(a -> new OrderAuditLogResponse(
                        a.getId(), a.getAction(), a.getActorType(), a.getActorId(),
                        a.getBeforeData(), a.getAfterData(), a.getIpAddress(), a.getCreatedAt()))
                .toList();
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

    /**
     * Batch-loads the shipping-address full name for the given orders, keyed by
     * order id. Used as a fallback for legacy orders whose own customer_name is
     * null even though the address carries the real name. One query, no N+1 —
     * {@code getOrder().getId()} reads the FK off the lazy proxy without a fetch.
     */
    private Map<UUID, String> batchShippingNames(List<UUID> orderIds) {
        if (orderIds.isEmpty()) return Map.of();
        Map<UUID, String> result = new HashMap<>();
        for (OrderAddressEntity address : addressRepo.findByOrderIdInAndType(orderIds, "SHIPPING")) {
            if (address.getFullName() != null && !address.getFullName().isBlank()) {
                result.putIfAbsent(address.getOrder().getId(), address.getFullName());
            }
        }
        return result;
    }

    private AdminOrderDetailResponse toDetail(OrderEntity order) {
        List<OrderLineItemEntity> lineItemEntities = lineItemRepo.findByOrderId(order.getId());
        Map<String, String> liveThumbnailByPk = thumbnailResolver.resolveLiveFallbacks(lineItemEntities);
        List<OrderLineItemResponse> lineItems = lineItemEntities.stream()
                .map(lineItem -> toLineItem(lineItem, liveThumbnailByPk))
                .toList();

        List<OrderAddressResponse> addresses = addressRepo.findByOrderId(order.getId())
                .stream().map(this::toAddress).toList();

        List<OrderShippingItemResponse> shippingItems = shippingItemRepo.findByOrderId(order.getId())
                .stream().map(this::toShippingItem).toList();

        List<OrderPaymentResponse> payments = paymentRepo.findByOrderId(order.getId())
                .stream().map(this::toPayment).toList();

        // Admin sees ALL notes (customerVisible=true AND false)
        List<AdminOrderNoteResponse> notes = noteRepo.findByOrderIdOrderByCreatedAtAsc(order.getId())
                .stream().map(this::toAdminNote).toList();

        String customerName = (order.getCustomerName() != null && !order.getCustomerName().isBlank())
                ? order.getCustomerName()
                : addresses.stream()
                        .filter(a -> "SHIPPING".equals(a.type()))
                        .findFirst()
                        .map(OrderAddressResponse::fullName)
                        .filter(s -> s != null && !s.isBlank())
                        .orElse(null);

        return new AdminOrderDetailResponse(
                order.getId(),
                order.getOrderNumber(),
                order.getOrderKey(),
                order.getStatus(),
                order.getFulfillmentType(),
                order.getTrackingNumber(),
                order.getShippingCarrier(),
                order.getShippedAt(),
                order.getCustomerEmail(),
                order.getCustomerPhone(),
                customerName,
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

    private OrderLineItemResponse toLineItem(
            OrderLineItemEntity lineItem,
            Map<String, String> liveThumbnailByPk
    ) {
        return orderItemMapper.toResponse(
                lineItem,
                thumbnailResolver.resolveThumbnail(lineItem, liveThumbnailByPk)
        );
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
