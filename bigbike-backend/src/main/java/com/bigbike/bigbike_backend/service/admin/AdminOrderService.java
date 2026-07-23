package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.OrderAuditLogResponse;
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
import com.bigbike.bigbike_backend.mapper.PaymentMapper;
import com.bigbike.bigbike_backend.mapper.ShippingMapper;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAddressEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderShippingItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderShippingItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.checkout.OrderNotificationService;
import com.bigbike.bigbike_backend.service.order.OrderLineItemThumbnailResolver;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.ws.AdminOrderWsService;
import static com.bigbike.bigbike_backend.service.admin.AdminOrderSupport.buildStatusChangedEvent;
import static com.bigbike.bigbike_backend.service.admin.AdminOrderSupport.parseFromDate;
import static com.bigbike.bigbike_backend.service.admin.AdminOrderSupport.parseToDate;
import static com.bigbike.bigbike_backend.service.admin.AdminOrderSupport.resolveSort;
import static com.bigbike.bigbike_backend.service.admin.AdminOrderSupport.withResolvedCustomerName;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
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
    private static final ObjectMapper AUDIT_MAPPER = new ObjectMapper();

    private static final Set<String> ALLOWED_ORDER_STATUSES = Set.of(
            "PENDING", "PROCESSING", "COMPLETED", "CANCELLED"
    );


    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS;
    static {
        ALLOWED_TRANSITIONS = new HashMap<>();
        ALLOWED_TRANSITIONS.put("PENDING",    Set.of("PROCESSING", "CANCELLED"));
        ALLOWED_TRANSITIONS.put("PROCESSING", Set.of("COMPLETED", "CANCELLED"));
        ALLOWED_TRANSITIONS.put("COMPLETED",  Set.of());
        ALLOWED_TRANSITIONS.put("CANCELLED",  Set.of());
    }

    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final OrderAddressJpaRepository addressRepo;
    private final OrderShippingItemJpaRepository shippingItemRepo;
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

    // List

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

    // Detail

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

    // Update order status

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

        // Idempotent: same status -> return current state, no write.
        if (currentStatus.equals(newStatus)) {
            return toDetail(order);
        }

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
        if ("CANCELLED".equals(newStatus)) {
            if (req.cancelReason() == null || req.cancelReason().isBlank()) {
                throw ValidationException.fromField("cancelReason", "REQUIRED",
                        "Lý do huỷ đơn là bắt buộc.");
            }
            order.setCancelReason(req.cancelReason().trim());
        }

        orderRepo.save(order);

        if ("COMPLETED".equals(newStatus) || "CANCELLED".equals(newStatus)) {
            webRevalidationService.revalidateProductsForOrder(orderId);
        }

        Map<String, Object> beforeData = new LinkedHashMap<>();
        beforeData.put("status", beforeStatus);
        Map<String, Object> afterData = new LinkedHashMap<>();
        afterData.put("status", newStatus);
        if ("CANCELLED".equals(newStatus)) {
            afterData.put("cancelReason", order.getCancelReason());
        }
        auditLogWriter.save(auditLogFactory.build("ADMIN", adminId, "ORDER_STATUS_UPDATED", "ORDER", order.getId(),
                writeAuditJson(beforeData), writeAuditJson(afterData), clientIp, userAgent));

        OrderEntity statusSnapshot = order;
        String statusForEmail = newStatus;
        adminOrderWsService.pushEvent(buildStatusChangedEvent(order, newStatus));
        runAfterCommit(() -> orderNotificationService.sendOrderStatusUpdate(statusSnapshot, statusForEmail));

        return toDetail(orderRepo.findById(orderId).orElseThrow());
    }

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
     * null even though the address carries the real name. One query, no N+1.
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
                order.getCancelReason(),
                lineItems,
                addresses,
                shippingItems,
                payments
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

    private static String writeAuditJson(Map<String, Object> fields) {
        try {
            return AUDIT_MAPPER.writeValueAsString(fields);
        } catch (JsonProcessingException ex) {
            return "{\"_serialization_error\":true}";
        }
    }
}
