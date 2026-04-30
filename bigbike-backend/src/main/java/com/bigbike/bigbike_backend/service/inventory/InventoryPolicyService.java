package com.bigbike.bigbike_backend.service.inventory;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import org.springframework.stereotype.Service;

@Service
public class InventoryPolicyService {

    private static final int FALLBACK_THRESHOLD = 5;

    private final SiteSettingJpaRepository settingRepo;

    public InventoryPolicyService(SiteSettingJpaRepository settingRepo) {
        this.settingRepo = settingRepo;
    }

    public int lowStockThreshold() {
        return settingRepo.findBySettingKey("low_stock_threshold")
                .map(s -> {
                    try { return Integer.parseInt(s.getSettingValue()); }
                    catch (NumberFormatException e) { return FALLBACK_THRESHOLD; }
                })
                .orElse(FALLBACK_THRESHOLD);
    }

    public ProductStockState computeStockState(int qty, int threshold) {
        if (qty <= 0) return ProductStockState.OUT_OF_STOCK;
        if (qty <= threshold) return ProductStockState.LOW_STOCK;
        return ProductStockState.IN_STOCK;
    }

    /**
     * Recomputes and sets stockState on the variant based on current quantityOnHand.
     * PREORDER and CONTACT_FOR_STOCK are admin-controlled and never overwritten.
     */
    public void recomputeStockState(ProductVariantEntity variant) {
        ProductStockState current = variant.getStockState();
        if (current == ProductStockState.PREORDER || current == ProductStockState.CONTACT_FOR_STOCK) {
            return;
        }
        variant.setStockState(computeStockState(variant.getQuantityOnHand(), lowStockThreshold()));
    }
}
