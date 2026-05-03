package com.bigbike.bigbike_backend.service.payment.sepay;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.service.inventory.InventoryPolicyService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class PendingOrderTimeoutJob {

    private static final Logger log = LoggerFactory.getLogger(PendingOrderTimeoutJob.class);

    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final ProductVariantJpaRepository variantRepo;
    private final ProductJpaRepository productRepo;
    private final StockMovementJpaRepository stockMovementRepo;
    private final InventoryPolicyService inventoryPolicyService;
    private final SepayRuntimeSettingsResolver settingsResolver;

    public PendingOrderTimeoutJob(
            OrderJpaRepository orderRepo,
            OrderLineItemJpaRepository lineItemRepo,
            ProductVariantJpaRepository variantRepo,
            ProductJpaRepository productRepo,
            StockMovementJpaRepository stockMovementRepo,
            InventoryPolicyService inventoryPolicyService,
            SepayRuntimeSettingsResolver settingsResolver
    ) {
        this.orderRepo = orderRepo;
        this.lineItemRepo = lineItemRepo;
        this.variantRepo = variantRepo;
        this.productRepo = productRepo;
        this.stockMovementRepo = stockMovementRepo;
        this.inventoryPolicyService = inventoryPolicyService;
        this.settingsResolver = settingsResolver;
    }

    /** Chạy mỗi giờ, kiểm tra đơn BANK_TRANSFER ON_HOLD quá hạn. */
    @Scheduled(fixedDelayString = "${app.bank-transfer.stale-check-interval-ms:3600000}")
    @Transactional
    public void cancelStaleOrders() {
        var settings = settingsResolver.get();
        if (!settings.enabled()) return;

        Instant cutoff = Instant.now().minusSeconds(settings.timeoutHours() * 3600L);
        List<OrderEntity> stale = orderRepo.findStaleBankTransferOrdersBefore(cutoff);

        for (OrderEntity order : stale) {
            // MONEY GUARD: có tiền vào rồi nhưng chưa match đủ → không auto-cancel, admin xử lý
            if (order.getPaidAmount() != null && order.getPaidAmount().compareTo(BigDecimal.ZERO) > 0) {
                log.warn("[PendingOrderTimeout] Order {} has paidAmount={} — skipping auto-cancel, requires admin review.",
                        order.getOrderNumber(), order.getPaidAmount());
                continue;
            }

            // DOUBLE-CANCEL GUARD: nếu stock đã được khôi phục trước đó thì bỏ qua.
            UUID orderId = order.getId();
            boolean stockAlreadyRestored = stockMovementRepo
                    .existsByReferenceTypeAndReferenceId("ORDER_CANCEL", orderId);

            if (!stockAlreadyRestored) {
                restoreNonSerialStock(orderId);
            }

            order.setStatus("CANCELLED");
            order.setPaymentStatus("CANCELLED");
            order.setCancelledAt(Instant.now());
            order.setUpdatedAt(Instant.now());
            orderRepo.save(order);
            log.info("[PendingOrderTimeout] Auto-cancelled stale bank transfer order: {}", order.getOrderNumber());
        }
    }

    private void restoreNonSerialStock(UUID orderId) {
        List<OrderLineItemEntity> items = lineItemRepo.findByOrderId(orderId);
        Instant now = Instant.now();
        int threshold = inventoryPolicyService.lowStockThreshold();

        for (OrderLineItemEntity item : items) {
            if (item.getProductId() == null) continue;

            if (item.getProductVariantId() != null) {
                variantRepo.findByIdForUpdate(item.getProductVariantId().toString()).ifPresent(variant -> {
                    int before = variant.getQuantityOnHand();
                    int after = before + item.getQuantity();
                    variant.setQuantityOnHand(after);
                    inventoryPolicyService.recomputeStockState(variant);
                    variantRepo.save(variant);

                    StockMovementEntity m = new StockMovementEntity();
                    m.setVariant(variant);
                    m.setMovementType("IN");
                    m.setQuantityDelta(item.getQuantity());
                    m.setQuantityBefore(before);
                    m.setQuantityAfter(after);
                    m.setReferenceType("ORDER_CANCEL");
                    m.setReferenceId(orderId);
                    m.setNote("AUTO_TIMEOUT_CANCEL");
                    m.setCreatedAt(now);
                    stockMovementRepo.save(m);
                });
            } else {
                productRepo.findByIdForUpdate(item.getProductId().toString()).ifPresent(product -> {
                    if (!Boolean.TRUE.equals(product.getManageStock()) || product.getStockQuantity() == null) return;
                    int restored = product.getStockQuantity() + item.getQuantity();
                    product.setStockQuantity(restored);
                    if (restored <= 0) {
                        product.setStockState(ProductStockState.OUT_OF_STOCK);
                    } else if (restored <= threshold) {
                        product.setStockState(ProductStockState.LOW_STOCK);
                    } else {
                        product.setStockState(ProductStockState.IN_STOCK);
                    }
                    productRepo.save(product);
                });
            }
        }
    }
}
