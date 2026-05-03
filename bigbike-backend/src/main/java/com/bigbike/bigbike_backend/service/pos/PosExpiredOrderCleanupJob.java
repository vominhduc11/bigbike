package com.bigbike.bigbike_backend.service.pos;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderNoteEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderNoteJpaRepository;
import com.bigbike.bigbike_backend.service.inventory.InventoryPolicyService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Chạy mỗi 5 phút — tìm đơn POS BANK_TRANSFER đã hết hạn 30 phút,
 * hoàn kho và huỷ đơn. Cần thiết vì POS trừ kho ngay khi tạo đơn.
 */
@Component
public class PosExpiredOrderCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(PosExpiredOrderCleanupJob.class);

    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final OrderNoteJpaRepository noteRepo;
    private final ProductVariantJpaRepository variantRepo;
    private final StockMovementJpaRepository stockMovementRepo;
    private final InventoryPolicyService inventoryPolicyService;

    public PosExpiredOrderCleanupJob(
            OrderJpaRepository orderRepo,
            OrderLineItemJpaRepository lineItemRepo,
            OrderNoteJpaRepository noteRepo,
            ProductVariantJpaRepository variantRepo,
            StockMovementJpaRepository stockMovementRepo,
            InventoryPolicyService inventoryPolicyService
    ) {
        this.orderRepo = orderRepo;
        this.lineItemRepo = lineItemRepo;
        this.noteRepo = noteRepo;
        this.variantRepo = variantRepo;
        this.stockMovementRepo = stockMovementRepo;
        this.inventoryPolicyService = inventoryPolicyService;
    }

    @Scheduled(fixedDelayString = "${app.pos.expired-cleanup-interval-ms:300000}")
    @Transactional
    public void cancelExpiredPosOrders() {
        Instant now = Instant.now();
        List<OrderEntity> expired = orderRepo.findExpiredPosOrders(now);
        if (expired.isEmpty()) return;

        log.info("[PosExpiredCleanup] Found {} expired POS order(s) to cancel.", expired.size());

        for (OrderEntity order : expired) {
            try {
                UUID orderId = order.getId();
                // Reload to detect concurrent payment confirmations since batch was fetched
                OrderEntity current = orderRepo.findById(orderId).orElse(null);
                if (current == null || !"ON_HOLD".equals(current.getStatus())) {
                    log.info("[PosExpiredCleanup] Order {} no longer ON_HOLD (status={}), skipping.",
                            order.getOrderNumber(), current != null ? current.getStatus() : "NOT_FOUND");
                    continue;
                }
                boolean stockAlreadyRestored = stockMovementRepo
                        .existsByReferenceTypeAndReferenceId("ORDER_CANCEL", orderId);
                if (!stockAlreadyRestored) {
                    restoreNonSerialStock(current, now);
                }
                cancelOrder(current, now);
                log.info("[PosExpiredCleanup] Cancelled POS order {} and restored stock.", current.getOrderNumber());
            } catch (Exception e) {
                log.error("[PosExpiredCleanup] Failed to process order {}: {}", order.getOrderNumber(), e.getMessage());
            }
        }
    }

    private void restoreNonSerialStock(OrderEntity order, Instant now) {
        List<OrderLineItemEntity> items = lineItemRepo.findByOrderId(order.getId());
        for (OrderLineItemEntity item : items) {
            if (item.getProductVariantId() == null) continue;

            ProductVariantEntity variant = variantRepo.findByIdForUpdate(item.getProductVariantId().toString())
                    .orElseThrow(() -> new NotFoundException("Variant không tìm thấy khi hoàn kho: " + item.getProductVariantId()));
            int before = variant.getQuantityOnHand();
            int after = before + item.getQuantity();
            variant.setQuantityOnHand(after);
            inventoryPolicyService.recomputeStockState(variant);
            variantRepo.save(variant);

            StockMovementEntity mv = new StockMovementEntity();
            mv.setVariant(variant);
            mv.setMovementType("IN");
            mv.setQuantityDelta(item.getQuantity());
            mv.setQuantityBefore(before);
            mv.setQuantityAfter(after);
            mv.setReferenceType("ORDER_CANCEL");
            mv.setReferenceId(order.getId());
            mv.setNote("POS_EXPIRED_ROLLBACK");
            mv.setCreatedAt(now);
            stockMovementRepo.save(mv);
        }
    }

    private void cancelOrder(OrderEntity order, Instant now) {
        order.setStatus("CANCELLED");
        order.setPaymentStatus("CANCELLED");
        order.setCancelledAt(now);
        order.setUpdatedAt(now);
        orderRepo.save(order);

        OrderNoteEntity note = new OrderNoteEntity();
        note.setOrder(order);
        note.setAuthorType("SYSTEM");
        note.setNoteType("SYSTEM");
        note.setContent("Đơn POS hết hạn thanh toán 30 phút — đã hoàn kho tự động.");
        note.setCustomerVisible(false);
        note.setCreatedAt(now);
        noteRepo.save(note);
    }
}
