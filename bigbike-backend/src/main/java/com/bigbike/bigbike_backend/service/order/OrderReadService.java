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
import com.bigbike.bigbike_backend.mapper.OrderAddressMapper;
import com.bigbike.bigbike_backend.mapper.OrderItemMapper;
import com.bigbike.bigbike_backend.mapper.OrderMapper;
import com.bigbike.bigbike_backend.mapper.OrderNoteMapper;
import com.bigbike.bigbike_backend.mapper.PaymentMapper;
import com.bigbike.bigbike_backend.mapper.ShippingMapper;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderNoteJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderShippingItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class OrderReadService {

    private static final int MAX_SIZE = 100;
    private static final int DEFAULT_SIZE = 20;

    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final ProductJpaRepository productRepo;
    private final OrderAddressJpaRepository addressRepo;
    private final OrderShippingItemJpaRepository shippingItemRepo;
    private final OrderNoteJpaRepository noteRepo;
    private final PaymentJpaRepository paymentRepo;
    private final OrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;
    private final OrderAddressMapper orderAddressMapper;
    private final ShippingMapper shippingMapper;
    private final PaymentMapper paymentMapper;
    private final OrderNoteMapper orderNoteMapper;

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
        Map<UUID, List<String>> namesMap = batchProductNames(orderIds);

        List<OrderListItemResponse> items = new ArrayList<>(dbPage.getContent().size());
        for (OrderEntity o : dbPage.getContent()) {
            items.add(toListItem(
                    o,
                    countMap.getOrDefault(o.getId(), 0L),
                    namesMap.getOrDefault(o.getId(), List.of())
            ));
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

    private OrderListItemResponse toListItem(OrderEntity order, long itemCount, List<String> productNames) {
        return orderMapper.toCustomerListItem(order, (int) itemCount, productNames);
    }

    private Map<UUID, Long> batchCountLineItems(List<UUID> orderIds) {
        if (orderIds.isEmpty()) return Map.of();
        return lineItemRepo.countByOrderIdIn(orderIds).stream()
                .collect(Collectors.toMap(
                        row -> (UUID) row[0],
                        row -> (Long) row[1]
                ));
    }

    /** Product-name summary per order, for the customer order history list. */
    private Map<UUID, List<String>> batchProductNames(List<UUID> orderIds) {
        if (orderIds.isEmpty()) return Map.of();
        return lineItemRepo.findProductNamesByOrderIdIn(orderIds).stream()
                .filter(row -> row[1] != null)
                .collect(Collectors.groupingBy(
                        row -> (UUID) row[0],
                        Collectors.mapping(row -> (String) row[1], Collectors.toList())
                ));
    }

    /**
     * Resolves a thumbnail URL per product (keyed by product_pk) for the given line items.
     * Read-time lookup against the current catalog image — order line items do not
     * snapshot the image. Returns only entries that actually have an image URL.
     */
    private Map<String, String> resolveProductThumbnails(List<OrderLineItemEntity> items) {
        List<String> productPks = items.stream()
                .map(OrderLineItemEntity::getProductPk)
                .filter(pk -> pk != null && !pk.isBlank())
                .distinct()
                .toList();
        if (productPks.isEmpty()) return Map.of();

        Map<String, String> byPk = new HashMap<>();
        for (Object[] row : productRepo.findImageUrlsByIds(productPks)) {
            if (row[1] != null) {
                byPk.put((String) row[0], (String) row[1]);
            }
        }
        return byPk;
    }

    private OrderDetailResponse toDetail(
            OrderEntity order,
            boolean customerVisibleNotesOnly,
            boolean includeOrderKey
    ) {
        List<OrderLineItemEntity> lineItemEntities = lineItemRepo.findByOrderId(order.getId());
        Map<String, String> thumbnailByProductPk = resolveProductThumbnails(lineItemEntities);
        List<OrderLineItemResponse> lineItems = lineItemEntities.stream()
                .map(e -> orderItemMapper.toResponse(e, thumbnailByProductPk.get(e.getProductPk())))
                .toList();

        List<OrderAddressResponse> addresses = addressRepo.findByOrderId(order.getId())
                .stream().map(orderAddressMapper::toResponse).toList();

        List<OrderShippingItemResponse> shippingItems = shippingItemRepo.findByOrderId(order.getId())
                .stream().map(shippingMapper::toResponse).toList();

        List<OrderPaymentResponse> payments = paymentRepo.findByOrderId(order.getId())
                .stream().map(paymentMapper::toResponse).toList();

        List<OrderNoteResponse> notes;
        if (customerVisibleNotesOnly) {
            notes = noteRepo.findByOrderIdAndCustomerVisibleOrderByCreatedAtAsc(order.getId(), true)
                    .stream().map(orderNoteMapper::toCustomerResponse).toList();
        } else {
            notes = noteRepo.findByOrderIdOrderByCreatedAtAsc(order.getId())
                    .stream().map(orderNoteMapper::toCustomerResponse).toList();
        }

        String visibleOrderKey = includeOrderKey ? order.getOrderKey() : null;
        return orderMapper.toDetailResponse(
                order,
                visibleOrderKey,
                lineItems,
                addresses,
                shippingItems,
                payments,
                notes
        );
    }

}
