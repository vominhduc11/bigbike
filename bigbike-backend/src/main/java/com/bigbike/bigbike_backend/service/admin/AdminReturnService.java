package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.returns.AdminCreateReturnRequest;
import com.bigbike.bigbike_backend.api.admin.dto.returns.AdminReturnDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.returns.AdminReturnDetailResponse.ReturnHistoryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.returns.AdminReturnDetailResponse.ReturnItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.returns.AdminReturnListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.returns.UpdateReturnStatusRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.mapper.ReturnRequestMapper;
import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnHistoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnItemEntity;
import com.bigbike.bigbike_backend.domain.catalog.ProductSerialStatus;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReturnItemSerialEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReturnItemSerialJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.returns.ReturnHistoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.returns.ReturnItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.returns.ReturnJpaRepository;
import com.bigbike.bigbike_backend.service.checkout.OrderNotificationService;
import com.bigbike.bigbike_backend.service.inventory.InventoryPolicyService;
import com.bigbike.bigbike_backend.service.inventory.SerialLifecycleService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminReturnService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    // Valid transitions:
    //   PENDING     → APPROVED | REJECTED
    //   APPROVED    → RECEIVED
    //   RECEIVED    → INSPECTING | COMPLETED | REFUNDED
    //   INSPECTING  → COMPLETED | REFUNDED | RECEIVED (re-receive if QC bounces back)
    //
    // INSPECTING is optional — high-risk goods (mũ bảo hiểm, áo giáp) must enter
    // INSPECTING before being marked COMPLETED so each ReturnItem is reviewed and
    // marked PASS/FAIL. Items marked FAIL are excluded from stock restore.
    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
            "PENDING",    Set.of("APPROVED", "REJECTED"),
            "APPROVED",   Set.of("RECEIVED"),
            "RECEIVED",   Set.of("INSPECTING", "COMPLETED", "REFUNDED"),
            "INSPECTING", Set.of("COMPLETED", "REFUNDED")
    );

    private static final Set<String> INSPECTION_RESULTS = Set.of("PASS", "FAIL");

    private final ReturnJpaRepository returnRepo;
    private final ReturnItemJpaRepository itemRepo;
    private final ReturnHistoryJpaRepository historyRepo;
    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final ProductJpaRepository productRepo;
    private final ProductVariantJpaRepository variantRepo;
    private final StockMovementJpaRepository stockMovementRepo;
    private final InventoryPolicyService inventoryPolicyService;
    private final SerialLifecycleService serialLifecycleService;
    private final ReturnItemSerialJpaRepository risRepo;
    private final OrderNotificationService notificationService;
    private final com.bigbike.bigbike_backend.service.payment.RefundService refundService;
    private final EntityManager em;
    private final ReturnRequestMapper returnRequestMapper;

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

        // When closing out of INSPECTING, every item must have an inspection result.
        // Skipping items would silently let unchecked goods be restored or refunded.
        if ("INSPECTING".equals(ret.getStatus())
                && ("COMPLETED".equals(newStatus) || "REFUNDED".equals(newStatus))) {
            List<ReturnItemEntity> items = itemRepo.findByReturnId(returnId);
            for (ReturnItemEntity it : items) {
                if (it.getInspectionResult() == null) {
                    throw ValidationException.fromField("items", "INSPECTION_INCOMPLETE",
                            "Vẫn còn món chưa được kiểm tra (PASS/FAIL). Sản phẩm: "
                            + it.getProductName());
                }
            }
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

        // When goods physically arrive: mark serials RETURNED (not IN_STOCK yet — needs INSPECTION).
        // Legacy (non-serial) items: stock restore happens at COMPLETED/REFUNDED as before.
        if ("RECEIVED".equals(newStatus)) {
            serialLifecycleService.receiveReturnForReturn(ret.getId());
        }

        // Move serial-tracked items from RETURNED → INSPECTION when QC process begins.
        if ("INSPECTING".equals(newStatus)) {
            serialLifecycleService.moveReturnedToInspection(ret.getId());
        }

        // Non-serial items: restore stock immediately on COMPLETED/REFUNDED.
        // Serial-tracked items: stock is only restored after admin sets INSPECTION → IN_STOCK
        // via PATCH /admin/inventory/serials/{id}/status.
        if ("COMPLETED".equals(newStatus) || "REFUNDED".equals(newStatus)) {
            restoreStockForReturn(ret.getId());
        }

        dispatchReturnNotification(ret, newStatus, order);

        return toDetail(ret, order);
    }

    // ── Per-item inspection ───────────────────────────────────────────────────

    /**
     * Records the quality-check decision for a single return item.
     *
     * <p>Allowed only while the parent return is in {@code INSPECTING}. Each
     * decision is one of:
     * <ul>
     *   <li>{@code PASS} — goods are sellable, will be restored to stock when the
     *       return transitions to {@code COMPLETED} or {@code REFUNDED}.</li>
     *   <li>{@code FAIL} — goods are not sellable (defective from use, missing parts,
     *       failed safety inspection); skipped during stock restore so they cannot
     *       be re-sold.</li>
     * </ul>
     *
     * <p>Inspecting an item is idempotent: calling again with a different result
     * overwrites the previous decision and re-stamps {@code inspectedAt} and
     * {@code inspectedByAdminId}.
     */
    @Transactional
    public AdminReturnDetailResponse inspectItem(
            UUID returnId, UUID itemId, UUID adminId,
            com.bigbike.bigbike_backend.api.admin.dto.returns.InspectReturnItemRequest req
    ) {
        ReturnEntity ret = returnRepo.findById(returnId)
                .orElseThrow(() -> new NotFoundException("Return not found."));

        if (!"INSPECTING".equals(ret.getStatus())) {
            throw new ConflictException(
                    "Chỉ có thể kiểm tra món hàng khi phiếu trả đang ở trạng thái INSPECTING. "
                    + "Trạng thái hiện tại: " + ret.getStatus());
        }

        ReturnItemEntity item = itemRepo.findById(itemId)
                .orElseThrow(() -> new NotFoundException("Return item not found."));

        if (!returnId.equals(item.getReturnId())) {
            throw new NotFoundException("Return item not found.");
        }

        String result = req.result() == null ? "" : req.result().toUpperCase(Locale.ROOT);
        if (!INSPECTION_RESULTS.contains(result)) {
            throw ValidationException.fromField("result", "INVALID",
                    "result phải là một trong: " + INSPECTION_RESULTS);
        }

        // note is required for FAIL — it drives the DAMAGED serial note.
        if ("FAIL".equals(result) && (req.note() == null || req.note().isBlank())) {
            throw ValidationException.fromField("note", "REQUIRED",
                    "Lý do bắt buộc khi kết quả kiểm tra là FAIL.");
        }

        Instant now = Instant.now();
        item.setInspectionResult(result);
        item.setInspectionNote(req.note());
        item.setInspectedAt(now);
        item.setInspectedByAdminId(adminId);
        itemRepo.save(item);

        // Sync serial status for serial-tracked return items.
        // PASS → IN_STOCK (resellable), FAIL → DAMAGED (excluded from stock restore).
        List<ReturnItemSerialEntity> serialBridges = risRepo.findByReturnItemId(itemId);
        if (!serialBridges.isEmpty()) {
            ProductSerialStatus targetStatus = "PASS".equals(result)
                    ? ProductSerialStatus.IN_STOCK
                    : ProductSerialStatus.DAMAGED;
            for (ReturnItemSerialEntity bridge : serialBridges) {
                serialLifecycleService.markInspectionResult(
                        bridge.getSerialId(), targetStatus, req.note());
            }
        }

        ret.setUpdatedAt(now);
        returnRepo.save(ret);

        OrderEntity order = orderRepo.findById(ret.getOrderId()).orElse(null);
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
        // Idempotency guard: if stock movements have already been written for this return, skip.
        if (stockMovementRepo.existsByReferenceTypeAndReferenceId("RETURN", returnId)) return;

        List<ReturnItemEntity> returnItems = itemRepo.findByReturnId(returnId);
        Instant now = Instant.now();
        int threshold = inventoryPolicyService.lowStockThreshold();

        for (ReturnItemEntity ri : returnItems) {
            if (ri.getOrderLineItemId() == null) continue;
            // Failed QC: keep the goods out of inventory — they go to scrap, not back on the shelf.
            if ("FAIL".equals(ri.getInspectionResult())) continue;
            // Serial-tracked return items: stock restores only after INSPECTION → IN_STOCK via serial API.
            if (!risRepo.findByReturnItemId(ri.getId()).isEmpty()) continue;
            lineItemRepo.findById(ri.getOrderLineItemId()).ifPresent((OrderLineItemEntity li) -> {
                if (li.getProductVariantId() != null) {
                    // Variant-level restore
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
                } else if (li.getProductId() != null) {
                    // Product-level restore (no-variant product) — mirrors OrderStockRestoreService
                    productRepo.findByIdForUpdate(li.getProductId().toString()).ifPresent(product -> {
                        if (!Boolean.TRUE.equals(product.getManageStock()) || product.getStockQuantity() == null) return;
                        int before = product.getStockQuantity();
                        int after = before + ri.getQuantity();
                        product.setStockQuantity(after);
                        if (after <= 0) product.setStockState(ProductStockState.OUT_OF_STOCK);
                        else if (after <= threshold) product.setStockState(ProductStockState.LOW_STOCK);
                        else product.setStockState(ProductStockState.IN_STOCK);
                        productRepo.save(product);
                        StockMovementEntity m = new StockMovementEntity();
                        m.setProductId(product.getId());
                        m.setMovementType("IN");
                        m.setQuantityDelta(ri.getQuantity());
                        m.setQuantityBefore(before);
                        m.setQuantityAfter(after);
                        m.setReferenceType("RETURN");
                        m.setReferenceId(returnId);
                        m.setCreatedAt(now);
                        stockMovementRepo.save(m);
                    });
                }
            });
        }
    }

    // ── Admin-initiated return creation ───────────────────────────────────────

    @Transactional
    public AdminReturnDetailResponse adminCreateReturn(AdminCreateReturnRequest req, UUID adminId) {
        OrderEntity order = orderRepo.findById(req.orderId())
                .orElseThrow(() -> new NotFoundException("Order not found."));

        if (!"COMPLETED".equals(order.getStatus())) {
            throw new ConflictException(
                    "Chỉ đơn hàng COMPLETED mới có thể tạo yêu cầu đổi trả. Trạng thái hiện tại: "
                    + order.getStatus());
        }

        boolean alreadyActive = returnRepo.findByOrderIdOrderByCreatedAtDesc(req.orderId())
                .stream().anyMatch(r -> "PENDING".equals(r.getStatus())
                        || "APPROVED".equals(r.getStatus())
                        || "RECEIVED".equals(r.getStatus())
                        || "INSPECTING".equals(r.getStatus()));
        if (alreadyActive) {
            throw new ConflictException("Đơn hàng này đang có yêu cầu đổi trả chưa hoàn tất.");
        }

        String reason = req.reason().toUpperCase(Locale.ROOT);

        Set<UUID> seen = new HashSet<>();
        for (AdminCreateReturnRequest.ReturnItemRequest item : req.items()) {
            if (!seen.add(item.orderLineItemId())) {
                throw ValidationException.fromField("items[].orderLineItemId", "DUPLICATE",
                        "Trùng orderLineItemId: " + item.orderLineItemId());
            }
        }

        Map<UUID, OrderLineItemEntity> lineItemMap = lineItemRepo.findByOrderId(req.orderId())
                .stream().collect(Collectors.toMap(OrderLineItemEntity::getId, li -> li));

        for (AdminCreateReturnRequest.ReturnItemRequest item : req.items()) {
            OrderLineItemEntity lineItem = lineItemMap.get(item.orderLineItemId());
            if (lineItem == null) {
                throw ValidationException.fromField("items[].orderLineItemId", "NOT_IN_ORDER",
                        "Line item không thuộc đơn hàng này: " + item.orderLineItemId());
            }
            int alreadyReturned = itemRepo.sumNonRejectedQuantityByLineItemId(item.orderLineItemId());
            int remaining = lineItem.getQuantity() - alreadyReturned;
            if (item.quantity() > remaining) {
                throw ValidationException.fromField("items[].quantity", "EXCEEDS_RETURNABLE",
                        "Số lượng " + item.quantity() + " vượt quá số có thể trả (" + remaining
                        + ") cho sản phẩm: " + lineItem.getProductName());
            }
        }

        Instant now = Instant.now();
        Long seq = (Long) em.createNativeQuery("SELECT nextval('return_number_seq')").getSingleResult();
        String returnNumber = String.format("RMA-%06d", seq);

        ReturnEntity ret = new ReturnEntity();
        ret.setReturnNumber(returnNumber);
        ret.setOrderId(req.orderId());
        ret.setCustomerId(order.getCustomerId());
        ret.setStatus("PENDING");
        ret.setReason(reason);
        ret.setCustomerNote(req.customerNote());
        ret.setRefundAmount(BigDecimal.ZERO);
        ret.setCreatedAt(now);
        ret.setUpdatedAt(now);
        returnRepo.save(ret);

        for (AdminCreateReturnRequest.ReturnItemRequest item : req.items()) {
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
        history.setNote("Yêu cầu đổi trả tạo bởi nhân viên.");
        history.setAdminId(adminId);
        history.setCreatedAt(now);
        historyRepo.save(history);

        return toDetail(ret, order);
    }

    // ── Returns by order ─────────────────────────────────────────────────────────

    public List<AdminReturnListItemResponse> listByOrderId(UUID orderId) {
        OrderEntity order = orderRepo.findById(orderId).orElse(null);
        return returnRepo.findByOrderIdOrderByCreatedAtDesc(orderId)
                .stream()
                .map(r -> toListItem(r, order))
                .toList();
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
        return returnRequestMapper.toAdminListItem(
                r,
                order != null ? order.getOrderNumber() : null,
                order != null ? order.getCustomerEmail() : null
        );
    }

    private AdminReturnDetailResponse toDetail(ReturnEntity r, OrderEntity order) {
        List<ReturnItemResponse> items = itemRepo.findByReturnId(r.getId())
                .stream().map(returnRequestMapper::toAdminItem).toList();

        List<ReturnHistoryResponse> history = historyRepo.findByReturnIdOrderByCreatedAtAsc(r.getId())
                .stream().map(returnRequestMapper::toAdminHistory).toList();

        return returnRequestMapper.toAdminDetail(
                r,
                order != null ? order.getOrderNumber() : null,
                order != null ? order.getCustomerEmail() : null,
                items,
                history
        );
    }
}
