package com.bigbike.bigbike_backend.service.order;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.api.order.dto.CreateReturnRequest;
import com.bigbike.bigbike_backend.api.order.dto.CustomerReturnResponse;
import com.bigbike.bigbike_backend.api.order.dto.CustomerReturnResponse.ReturnHistoryResponse;
import com.bigbike.bigbike_backend.api.order.dto.CustomerReturnResponse.ReturnItemResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnHistoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnItemEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.returns.ReturnHistoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.returns.ReturnItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.returns.ReturnJpaRepository;
import com.bigbike.bigbike_backend.service.checkout.OrderNotificationService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerReturnService {

    private static final Set<String> RETURNABLE_STATUSES = Set.of("COMPLETED");
    private static final Set<String> VALID_REASONS =
            Set.of("DEFECTIVE", "WRONG_ITEM", "NOT_AS_DESCRIBED", "CHANGED_MIND", "OTHER");

    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final ReturnJpaRepository returnRepo;
    private final ReturnItemJpaRepository itemRepo;
    private final ReturnHistoryJpaRepository historyRepo;
    private final OrderNotificationService notificationService;
    private final EntityManager em;

    public CustomerReturnService(
            OrderJpaRepository orderRepo,
            OrderLineItemJpaRepository lineItemRepo,
            ReturnJpaRepository returnRepo,
            ReturnItemJpaRepository itemRepo,
            ReturnHistoryJpaRepository historyRepo,
            OrderNotificationService notificationService,
            EntityManager em
    ) {
        this.orderRepo = orderRepo;
        this.lineItemRepo = lineItemRepo;
        this.returnRepo = returnRepo;
        this.itemRepo = itemRepo;
        this.historyRepo = historyRepo;
        this.notificationService = notificationService;
        this.em = em;
    }

    @Transactional
    public CustomerReturnResponse createReturn(UUID customerId, UUID orderId, CreateReturnRequest req) {
        OrderEntity order = orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found."));

        if (!customerId.equals(order.getCustomerId())) {
            throw new NotFoundException("Order not found.");
        }

        if (!RETURNABLE_STATUSES.contains(order.getStatus())) {
            throw ValidationException.fromField("orderId", "NOT_RETURNABLE",
                    "Only COMPLETED orders can be returned. Current status: " + order.getStatus());
        }

        String reason = req.reason().toUpperCase(Locale.ROOT);
        if (!VALID_REASONS.contains(reason)) {
            throw ValidationException.fromField("reason", "INVALID",
                    "reason must be one of: " + VALID_REASONS);
        }

        // Duplicate-in-progress check (also guarded by partial unique index V65)
        boolean alreadyActive = returnRepo.findByOrderIdOrderByCreatedAtDesc(orderId)
                .stream().anyMatch(r -> "PENDING".equals(r.getStatus())
                        || "APPROVED".equals(r.getStatus())
                        || "RECEIVED".equals(r.getStatus()));
        if (alreadyActive) {
            throw ValidationException.fromField("orderId", "RETURN_IN_PROGRESS",
                    "A return request for this order is already in progress.");
        }

        // Reject duplicate orderLineItemId in the same payload
        Set<UUID> seen = new HashSet<>();
        for (CreateReturnRequest.ReturnItemRequest item : req.items()) {
            if (!seen.add(item.orderLineItemId())) {
                throw ValidationException.fromField("items[].orderLineItemId", "DUPLICATE",
                        "Duplicate orderLineItemId in request: " + item.orderLineItemId());
            }
        }

        // Build a lookup map of line items that belong to this order
        Map<UUID, OrderLineItemEntity> lineItemMap = lineItemRepo.findByOrderId(orderId)
                .stream().collect(Collectors.toMap(OrderLineItemEntity::getId, li -> li));

        // Validate every requested item before persisting anything
        for (CreateReturnRequest.ReturnItemRequest item : req.items()) {
            OrderLineItemEntity lineItem = lineItemMap.get(item.orderLineItemId());
            if (lineItem == null) {
                throw ValidationException.fromField("items[].orderLineItemId", "NOT_IN_ORDER",
                        "Line item " + item.orderLineItemId() + " does not belong to order " + orderId);
            }
            int alreadyReturned = itemRepo.sumNonRejectedQuantityByLineItemId(item.orderLineItemId());
            int remaining = lineItem.getQuantity() - alreadyReturned;
            if (item.quantity() > remaining) {
                throw ValidationException.fromField("items[].quantity", "EXCEEDS_RETURNABLE",
                        "Quantity " + item.quantity() + " exceeds returnable remaining (" + remaining + ") for line item " + item.orderLineItemId());
            }
        }

        Instant now = Instant.now();
        String returnNumber = generateReturnNumber();

        ReturnEntity ret = new ReturnEntity();
        ret.setReturnNumber(returnNumber);
        ret.setOrderId(orderId);
        ret.setCustomerId(customerId);
        ret.setStatus("PENDING");
        ret.setReason(reason);
        ret.setCustomerNote(req.customerNote());
        ret.setRefundAmount(BigDecimal.ZERO);
        ret.setCreatedAt(now);
        ret.setUpdatedAt(now);
        returnRepo.save(ret);

        for (CreateReturnRequest.ReturnItemRequest item : req.items()) {
            OrderLineItemEntity lineItem = lineItemMap.get(item.orderLineItemId());
            ReturnItemEntity itemEntity = new ReturnItemEntity();
            itemEntity.setReturnId(ret.getId());
            itemEntity.setOrderLineItemId(item.orderLineItemId());
            itemEntity.setProductName(lineItem.getProductName());
            itemEntity.setVariantName(lineItem.getVariantName());
            itemEntity.setSku(lineItem.getSku());
            itemEntity.setQuantity(item.quantity());
            itemEntity.setUnitPrice(lineItem.getUnitPrice());
            itemEntity.setReason(item.reason());
            itemEntity.setCreatedAt(now);
            itemRepo.save(itemEntity);
        }

        ReturnHistoryEntity history = new ReturnHistoryEntity();
        history.setReturnId(ret.getId());
        history.setFromStatus(null);
        history.setToStatus("PENDING");
        history.setNote("Return request submitted by customer.");
        history.setCreatedAt(now);
        historyRepo.save(history);

        try {
            notificationService.sendReturnReceived(ret, order.getCustomerEmail(), order.getOrderNumber());
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(CustomerReturnService.class)
                    .warn("Return-received notification failed for {}: {}", ret.getReturnNumber(), e.getMessage());
        }

        return toDetail(ret, order.getOrderNumber());
    }

    public List<CustomerReturnResponse> listCustomerReturns(UUID customerId) {
        return returnRepo.findByCustomerIdOrderByCreatedAtDesc(customerId)
                .stream().map(r -> {
                    String orderNumber = orderRepo.findById(r.getOrderId())
                            .map(OrderEntity::getOrderNumber).orElse(null);
                    return toDetail(r, orderNumber);
                }).toList();
    }

    public CustomerReturnResponse getCustomerReturn(UUID customerId, UUID returnId) {
        ReturnEntity ret = returnRepo.findById(returnId)
                .orElseThrow(() -> new NotFoundException("Return request not found."));
        if (!customerId.equals(ret.getCustomerId())) {
            throw new NotFoundException("Return request not found.");
        }
        String orderNumber = orderRepo.findById(ret.getOrderId())
                .map(OrderEntity::getOrderNumber).orElse(null);
        return toDetail(ret, orderNumber);
    }

    private CustomerReturnResponse toDetail(ReturnEntity r, String orderNumber) {
        List<ReturnItemResponse> items = itemRepo.findByReturnId(r.getId())
                .stream().map(i -> new ReturnItemResponse(
                        i.getId(), i.getProductName(), i.getVariantName(),
                        i.getSku(), i.getQuantity(), i.getUnitPrice(), i.getReason()
                )).toList();

        List<ReturnHistoryResponse> history = historyRepo.findByReturnIdOrderByCreatedAtAsc(r.getId())
                .stream().map(h -> new ReturnHistoryResponse(
                        h.getFromStatus(), h.getToStatus(), h.getNote(), h.getCreatedAt()
                )).toList();

        return new CustomerReturnResponse(
                r.getId(), r.getReturnNumber(), r.getOrderId(), orderNumber,
                r.getStatus(), r.getReason(), r.getCustomerNote(), r.getAdminNote(),
                r.getRefundAmount(), items, history, r.getCreatedAt(), r.getUpdatedAt()
        );
    }

    private String generateReturnNumber() {
        Long seq = (Long) em.createNativeQuery("SELECT nextval('return_number_seq')").getSingleResult();
        return String.format("RMA-%06d", seq);
    }
}
