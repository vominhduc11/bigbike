package com.bigbike.bigbike_backend.service.inventory;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Authoritative stock-restore handler for order cancel and order refund flows.
 * Idempotent: a second call for the same (referenceType, orderId) pair is a no-op.
 */
@Service
public class OrderStockRestoreService {

    private final OrderLineItemJpaRepository lineItemRepo;
    private final ProductJpaRepository productRepo;
    private final ProductVariantJpaRepository variantRepo;
    private final StockMovementJpaRepository stockMovementRepo;
    private final InventoryPolicyService inventoryPolicyService;

    public OrderStockRestoreService(
            OrderLineItemJpaRepository lineItemRepo,
            ProductJpaRepository productRepo,
            ProductVariantJpaRepository variantRepo,
            StockMovementJpaRepository stockMovementRepo,
            InventoryPolicyService inventoryPolicyService
    ) {
        this.lineItemRepo = lineItemRepo;
        this.productRepo = productRepo;
        this.variantRepo = variantRepo;
        this.stockMovementRepo = stockMovementRepo;
        this.inventoryPolicyService = inventoryPolicyService;
    }

    @Transactional
    public void restoreForCancel(UUID orderId) {
        if (stockMovementRepo.existsByReferenceTypeAndReferenceId("ORDER_CANCEL", orderId)) return;
        doRestore(orderId, "ORDER_CANCEL");
    }

    @Transactional
    public void restoreForRefund(UUID orderId) {
        if (stockMovementRepo.existsByReferenceTypeAndReferenceId("ORDER_REFUND", orderId)) return;
        doRestore(orderId, "ORDER_REFUND");
    }

    private void doRestore(UUID orderId, String referenceType) {
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
                    m.setReferenceType(referenceType);
                    m.setReferenceId(orderId);
                    m.setCreatedAt(now);
                    stockMovementRepo.save(m);
                });
            } else {
                productRepo.findByIdForUpdate(item.getProductId().toString()).ifPresent(product -> {
                    if (!Boolean.TRUE.equals(product.getManageStock()) || product.getStockQuantity() == null) return;
                    int before = product.getStockQuantity();
                    int after = before + item.getQuantity();
                    product.setStockQuantity(after);
                    if (after <= 0) product.setStockState(ProductStockState.OUT_OF_STOCK);
                    else if (after <= threshold) product.setStockState(ProductStockState.LOW_STOCK);
                    else product.setStockState(ProductStockState.IN_STOCK);
                    productRepo.save(product);

                    StockMovementEntity m = new StockMovementEntity();
                    m.setProductId(product.getId());
                    m.setMovementType("IN");
                    m.setQuantityDelta(item.getQuantity());
                    m.setQuantityBefore(before);
                    m.setQuantityAfter(after);
                    m.setReferenceType(referenceType);
                    m.setReferenceId(orderId);
                    m.setCreatedAt(now);
                    stockMovementRepo.save(m);
                });
            }
        }
    }
}
