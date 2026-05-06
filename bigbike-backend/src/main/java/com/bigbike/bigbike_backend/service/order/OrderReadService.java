package com.bigbike.bigbike_backend.service.order;

import com.bigbike.bigbike_backend.api.order.dto.OrderAddressResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderDetailResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderLineItemResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderListItemResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderNoteResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderPaymentResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderShippingItemResponse;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAddressEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderNoteEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderShippingItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderNoteJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderShippingItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

@Service
public class OrderReadService {

    private static final int MAX_SIZE = 100;
    private static final int DEFAULT_SIZE = 20;

    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final OrderAddressJpaRepository addressRepo;
    private final OrderShippingItemJpaRepository shippingItemRepo;
    private final OrderNoteJpaRepository noteRepo;
    private final PaymentJpaRepository paymentRepo;

    public OrderReadService(
            OrderJpaRepository orderRepo,
            OrderLineItemJpaRepository lineItemRepo,
            OrderAddressJpaRepository addressRepo,
            OrderShippingItemJpaRepository shippingItemRepo,
            OrderNoteJpaRepository noteRepo,
            PaymentJpaRepository paymentRepo
    ) {
        this.orderRepo = orderRepo;
        this.lineItemRepo = lineItemRepo;
        this.addressRepo = addressRepo;
        this.shippingItemRepo = shippingItemRepo;
        this.noteRepo = noteRepo;
        this.paymentRepo = paymentRepo;
    }

    // ── Customer orders list ──────────────────────────────────────────────────

    public PageResult<OrderListItemResponse> listCustomerOrders(
            UUID customerId, int page, int size, String status, String paymentStatus
    ) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        Specification<OrderEntity> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("customerId"), customerId));
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(cb.upper(root.get("status")), status.toUpperCase()));
            }
            if (paymentStatus != null && !paymentStatus.isBlank()) {
                predicates.add(cb.equal(cb.upper(root.get("paymentStatus")), paymentStatus.toUpperCase()));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Sort sort = Sort.by(Sort.Order.desc("placedAt").nullsLast(), Sort.Order.desc("createdAt"));
        PageRequest pageable = PageRequest.of(normalizedPage - 1, normalizedSize, sort);
        Page<OrderEntity> dbPage = orderRepo.findAll(spec, pageable);

        List<UUID> orderIds = dbPage.getContent().stream().map(OrderEntity::getId).toList();
        Map<UUID, Long> countMap = batchCountLineItems(orderIds);

        List<OrderListItemResponse> items = new ArrayList<>(dbPage.getContent().size());
        for (OrderEntity o : dbPage.getContent()) {
            items.add(toListItem(o, countMap.getOrDefault(o.getId(), 0L)));
        }

        return new PageResult<>(items, normalizedPage, normalizedSize, dbPage.getTotalElements(), dbPage.getTotalPages());
    }

    // ── Customer order detail (ownership enforced) ────────────────────────────

    public OrderDetailResponse getCustomerOrderDetail(UUID customerId, UUID orderId) {
        OrderEntity order = orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found."));
        // Return 404 regardless — do not leak whether order exists for another customer
        if (!customerId.equals(order.getCustomerId())) {
            throw new NotFoundException("Order not found.");
        }
        return toDetail(order, true, false);
    }

    // ── Guest order lookup by orderNumber + orderKey ──────────────────────────

    public OrderDetailResponse guestLookup(String orderNumber, String orderKey) {
        if (orderNumber == null || orderNumber.isBlank()) {
            throw ValidationException.fromField("orderNumber", "REQUIRED", "orderNumber is required.");
        }
        if (orderKey == null || orderKey.isBlank()) {
            throw ValidationException.fromField("orderKey", "REQUIRED", "orderKey is required.");
        }

        OrderEntity order = orderRepo.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new NotFoundException("Order not found."));

        // Exact match on order key — prevents enumeration
        if (!orderKey.equals(order.getOrderKey())) {
            throw new NotFoundException("Order not found.");
        }

        return toDetail(order, true, true);
    }

    // ── Mapping helpers ───────────────────────────────────────────────────────

    private OrderListItemResponse toListItem(OrderEntity order, long itemCount) {
        return new OrderListItemResponse(
                order.getId(),
                order.getOrderNumber(),
                order.getStatus(),
                order.getPaymentStatus(),
                order.getTotalAmount(),
                order.getCurrency(),
                order.getPlacedAt(),
                (int) itemCount
        );
    }

    private Map<UUID, Long> batchCountLineItems(List<UUID> orderIds) {
        if (orderIds.isEmpty()) return Map.of();
        return lineItemRepo.countByOrderIdIn(orderIds).stream()
                .collect(Collectors.toMap(
                        row -> (UUID) row[0],
                        row -> (Long) row[1]
                ));
    }

    private OrderDetailResponse toDetail(
            OrderEntity order,
            boolean customerVisibleNotesOnly,
            boolean includeOrderKey
    ) {
        List<OrderLineItemResponse> lineItems = lineItemRepo.findByOrderId(order.getId())
                .stream().map(this::toLineItem).toList();

        List<OrderAddressResponse> addresses = addressRepo.findByOrderId(order.getId())
                .stream().map(this::toAddress).toList();

        List<OrderShippingItemResponse> shippingItems = shippingItemRepo.findByOrderId(order.getId())
                .stream().map(this::toShippingItem).toList();

        List<OrderPaymentResponse> payments = paymentRepo.findByOrderId(order.getId())
                .stream().map(this::toPayment).toList();

        List<OrderNoteResponse> notes;
        if (customerVisibleNotesOnly) {
            notes = noteRepo.findByOrderIdAndCustomerVisibleOrderByCreatedAtAsc(order.getId(), true)
                    .stream().map(this::toNote).toList();
        } else {
            notes = noteRepo.findByOrderIdOrderByCreatedAtAsc(order.getId())
                    .stream().map(this::toNote).toList();
        }

        return new OrderDetailResponse(
                order.getId(),
                order.getOrderNumber(),
                includeOrderKey ? order.getOrderKey() : null,
                order.getStatus(),
                order.getPaymentStatus(),
                order.getFulfillmentStatus(),
                order.getCustomerEmail(),
                order.getCustomerPhone(),
                order.getCustomerNote(),
                order.getCurrency(),
                order.getSubtotalAmount(),
                order.getDiscountAmount(),
                order.getShippingAmount(),
                order.getFeeAmount(),
                order.getTaxAmount(),
                order.getTotalAmount(),
                order.getPaidAmount(),
                order.getRefundAmount(),
                order.getRefundReason(),
                order.getRefundedAt(),
                order.getPlacedAt(),
                lineItems,
                addresses,
                shippingItems,
                payments,
                notes
        );
    }

    private OrderLineItemResponse toLineItem(OrderLineItemEntity e) {
        return new OrderLineItemResponse(
                e.getId(),
                e.getProductId(),
                e.getProductVariantId(),
                e.getSku(),
                e.getProductName(),
                e.getVariantName(),
                e.getQuantity(),
                e.getUnitPrice(),
                e.getLineSubtotal(),
                e.getLineDiscount(),
                e.getLineTotal()
        );
    }

    private OrderAddressResponse toAddress(OrderAddressEntity e) {
        return new OrderAddressResponse(
                e.getType(),
                e.getFullName(),
                e.getEmail(),
                e.getPhone(),
                e.getCountry(),
                e.getProvince(),
                e.getDistrict(),
                e.getWard(),
                e.getAddressLine1(),
                e.getAddressLine2()
        );
    }

    private OrderShippingItemResponse toShippingItem(OrderShippingItemEntity e) {
        return new OrderShippingItemResponse(
                e.getId(),
                e.getMethodCode(),
                e.getMethodTitle(),
                e.getAmount()
        );
    }

    private OrderPaymentResponse toPayment(PaymentEntity e) {
        return new OrderPaymentResponse(
                e.getId(),
                e.getPaymentMethod(),
                e.getStatus(),
                e.getAmount(),
                e.getCurrency(),
                e.getPaidAt()
        );
    }

    private OrderNoteResponse toNote(OrderNoteEntity e) {
        return new OrderNoteResponse(
                e.getId(),
                e.getContent(),
                e.getCreatedAt()
        );
    }
}
