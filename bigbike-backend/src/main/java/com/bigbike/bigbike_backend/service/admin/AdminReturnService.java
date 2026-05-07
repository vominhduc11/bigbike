package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.returns.AdminReturnDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.returns.AdminReturnDetailResponse.ReturnHistoryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.returns.AdminReturnDetailResponse.ReturnItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.returns.AdminReturnListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.returns.UpdateReturnStatusRequest;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnHistoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnItemEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.returns.ReturnHistoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.returns.ReturnItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.returns.ReturnJpaRepository;
import com.bigbike.bigbike_backend.service.checkout.OrderNotificationService;
import com.bigbike.bigbike_backend.service.inventory.InventoryPolicyService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminReturnService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    // Valid transitions: PENDING → APPROVED | REJECTED
    //                    APPROVED → RECEIVED
    //                    RECEIVED → COMPLETED | REFUNDED
    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
            "PENDING",  Set.of("APPROVED", "REJECTED"),
            "APPROVED", Set.of("RECEIVED"),
            "RECEIVED", Set.of("COMPLETED", "REFUNDED")
    );

    private final ReturnJpaRepository returnRepo;
    private final ReturnItemJpaRepository itemRepo;
    private final ReturnHistoryJpaRepository historyRepo;
    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final ProductVariantJpaRepository variantRepo;
    private final StockMovementJpaRepository stockMovementRepo;
    private final InventoryPolicyService inventoryPolicyService;
    private final OrderNotificationService notificationService;
    private final com.bigbike.bigbike_backend.service.payment.RefundService refundService;

    public AdminReturnService(
            ReturnJpaRepository returnRepo,
            ReturnItemJpaRepository itemRepo,
            ReturnHistoryJpaRepository historyRepo,
            OrderJpaRepository orderRepo,
            OrderLineItemJpaRepository lineItemRepo,
            ProductVariantJpaRepository variantRepo,
            StockMovementJpaRepository stockMovementRepo,
            InventoryPolicyService inventoryPolicyService,
            OrderNotificationService notificationService,
            com.bigbike.bigbike_backend.service.payment.RefundService refundService
    ) {
        this.returnRepo = returnRepo;
        this.itemRepo = itemRepo;
        this.historyRepo = historyRepo;
        this.orderRepo = orderRepo;
        this.lineItemRepo = lineItemRepo;
        this.variantRepo = variantRepo;
        this.stockMovementRepo = stockMovementRepo;
        this.inventoryPolicyService = inventoryPolicyService;
        this.notificationService = notificationService;
        this.refundService = refundService;
    }

    // ── List (server-side pagination) ─────────────────────────────────────────

    public PageResult<AdminReturnListItemResponse> listReturns(
            int page, int size, String status, String q
    ) {
        int pg = Math.max(1, page) - 1;
        int sz = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        Specification<ReturnEntity> spec = buildSpec(status, q);
        PageRequest pageable = PageRequest.of(pg, sz, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<ReturnEntity> result = returnRepo.findAll(spec, pageable);

        List<AdminReturnListItemResponse> items = result.getContent().stream()
                .map(r -> {
                    OrderEntity order = orderRepo.findById(r.getOrderId()).orElse(null);
                    return toListItem(r, order);
                })
                .toList();

        return new PageResult<>(
                items,
                result.getNumber() + 1,
                result.getSize(),
                (int) result.getTotalElements(),
                result.getTotalPages()
        );
    }

    // ── Detail ────────────────────────────────────────────────────────────────

    public AdminReturnDetailResponse getReturnDetail(UUID returnId) {
        ReturnEntity ret = returnRepo.findById(returnId)
                .orElseThrow(() -> new NotFoundException("Return not found."));
        OrderEntity order = orderRepo.findById(ret.getOrderId()).orElse(null);
        return toDetail(ret, order);
    }

    // ── Update status ─────────────────────────────────────────────────────────

    @Transactional
    public AdminReturnDetailResponse updateStatus(UUID returnId, UUID adminId, UpdateReturnStatusRequest req) {
        ReturnEntity ret = returnRepo.findById(returnId)
                .orElseThrow(() -> new NotFoundException("Return not found."));

        String newStatus = req.status().toUpperCase(Locale.ROOT);
        Set<String> allowed = TRANSITIONS.getOrDefault(ret.getStatus(), Set.of());
        if (!allowed.contains(newStatus)) {
            throw ValidationException.fromField("status", "INVALID_TRANSITION",
                    "Cannot transition from " + ret.getStatus() + " to " + newStatus +
                    ". Allowed: " + allowed);
        }

        if ("REFUNDED".equals(newStatus)) {
            if (req.refundAmount() == null || req.refundAmount().compareTo(java.math.BigDecimal.ZERO) <= 0) {
                throw ValidationException.fromField("refundAmount", "REQUIRED",
                        "refundAmount must be provided and > 0 when transitioning to REFUNDED.");
            }
        }

        String oldStatus = ret.getStatus();
        ret.setStatus(newStatus);
        if (req.adminNote() != null) ret.setAdminNote(req.adminNote());
        if (req.refundAmount() != null) ret.setRefundAmount(req.refundAmount());
        ret.setUpdatedAt(Instant.now());
        returnRepo.save(ret);

        ReturnHistoryEntity history = new ReturnHistoryEntity();
        history.setReturnId(ret.getId());
        history.setFromStatus(oldStatus);
        history.setToStatus(newStatus);
        history.setNote(req.adminNote());
        history.setAdminId(adminId);
        history.setCreatedAt(Instant.now());
        historyRepo.save(history);

        OrderEntity order = orderRepo.findById(ret.getOrderId()).orElse(null);

        // Full refund sync via unified RefundService — updates paymentStatus, PaymentEntity, note, audit, WS
        if ("REFUNDED".equals(newStatus) && order != null) {
            refundService.applyRefund(
                    order.getId(), adminId,
                    req.refundAmount(), ret.getReason(),
                    req.adminNote(), false, null, null);
        }

        // Restore stock when goods are confirmed received back into warehouse.
        // COMPLETED = accepted/exchanged, no refund. REFUNDED = money returned, goods also back.
        // Both transitions physically return items to inventory.
        if ("COMPLETED".equals(newStatus) || "REFUNDED".equals(newStatus)) {
            restoreStockForReturn(ret.getId());
        }

        dispatchReturnNotification(ret, newStatus, order);

        return toDetail(ret, order);
    }

    // ── Notification dispatch ─────────────────────────────────────────────────

    private void dispatchReturnNotification(ReturnEntity ret, String newStatus, OrderEntity order) {
        try {
            if (order == null) return;
            String email = order.getCustomerEmail();
            String orderNumber = order.getOrderNumber();
            switch (newStatus) {
                case "APPROVED"  -> notificationService.sendReturnApproved(ret, email, orderNumber);
                case "REJECTED"  -> notificationService.sendReturnRejected(ret, email, orderNumber);
                case "RECEIVED"  -> notificationService.sendReturnGoodsReceived(ret, email, orderNumber);
                case "REFUNDED"  -> notificationService.sendReturnRefunded(ret, email, orderNumber);
                default -> {} // COMPLETED — internal closing, no customer email
            }
        } catch (Exception e) {
            LoggerFactory.getLogger(AdminReturnService.class)
                    .warn("Return notification failed for {} → {}: {}", ret.getReturnNumber(), newStatus, e.getMessage());
        }
    }

    // ── Stock restore ─────────────────────────────────────────────────────────

    private void restoreStockForReturn(UUID returnId) {
        List<ReturnItemEntity> returnItems = itemRepo.findByReturnId(returnId);
        Instant now = Instant.now();
        for (ReturnItemEntity ri : returnItems) {
            if (ri.getOrderLineItemId() == null) continue;
            lineItemRepo.findById(ri.getOrderLineItemId()).ifPresent((OrderLineItemEntity li) -> {
                if (li.getProductVariantId() == null) return;
                variantRepo.findByIdForUpdate(li.getProductVariantId().toString()).ifPresent(variant -> {
                    int before = variant.getQuantityOnHand();
                    int after = before + ri.getQuantity();
                    variant.setQuantityOnHand(after);
                    inventoryPolicyService.recomputeStockState(variant);
                    variantRepo.save(variant);
                    StockMovementEntity m = new StockMovementEntity();
                    m.setVariant(variant);
                    m.setMovementType("IN");
                    m.setQuantityDelta(ri.getQuantity());
                    m.setQuantityBefore(before);
                    m.setQuantityAfter(after);
                    m.setReferenceType("RETURN");
                    m.setReferenceId(returnId);
                    m.setCreatedAt(now);
                    stockMovementRepo.save(m);
                });
            });
        }
    }

    // ── Spec builder ──────────────────────────────────────────────────────────

    private Specification<ReturnEntity> buildSpec(String status, String q) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), status.toUpperCase(Locale.ROOT)));
            }
            if (q != null && !q.isBlank()) {
                String pattern = "%" + q.toLowerCase(Locale.ROOT) + "%";
                Predicate byRma = cb.like(cb.lower(root.get("returnNumber")), pattern);
                // Subquery: find order UUIDs whose orderNumber matches q
                Subquery<UUID> orderSub = query.subquery(UUID.class);
                Root<OrderEntity> orderRoot = orderSub.from(OrderEntity.class);
                orderSub.select(orderRoot.get("id"))
                        .where(cb.like(cb.lower(orderRoot.get("orderNumber")), pattern));
                Predicate byOrderNum = root.get("orderId").in(orderSub);
                predicates.add(cb.or(byRma, byOrderNum));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private AdminReturnListItemResponse toListItem(ReturnEntity r, OrderEntity order) {
        return new AdminReturnListItemResponse(
                r.getId(), r.getReturnNumber(), r.getOrderId(),
                order != null ? order.getOrderNumber() : null,
                order != null ? order.getCustomerEmail() : null,
                r.getStatus(), r.getReason(), r.getRefundAmount(), r.getCreatedAt()
        );
    }

    private AdminReturnDetailResponse toDetail(ReturnEntity r, OrderEntity order) {
        List<ReturnItemResponse> items = itemRepo.findByReturnId(r.getId())
                .stream().map(i -> new ReturnItemResponse(
                        i.getId(), i.getProductName(), i.getVariantName(),
                        i.getSku(), i.getQuantity(), i.getUnitPrice(), i.getReason()
                )).toList();

        List<ReturnHistoryResponse> history = historyRepo.findByReturnIdOrderByCreatedAtAsc(r.getId())
                .stream().map(h -> new ReturnHistoryResponse(
                        h.getFromStatus(), h.getToStatus(), h.getNote(), h.getCreatedAt()
                )).toList();

        return new AdminReturnDetailResponse(
                r.getId(), r.getReturnNumber(), r.getOrderId(), r.getCustomerId(),
                order != null ? order.getOrderNumber() : null,
                order != null ? order.getCustomerEmail() : null,
                r.getStatus(), r.getReason(), r.getCustomerNote(), r.getAdminNote(),
                r.getRefundAmount(), items, history, r.getCreatedAt(), r.getUpdatedAt()
        );
    }
}
