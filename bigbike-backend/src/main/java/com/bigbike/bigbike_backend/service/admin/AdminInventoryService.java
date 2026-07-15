package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.InventorySummaryResponse;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import static com.bigbike.bigbike_backend.service.admin.AdminInventoryMapper.parseState;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-only inventory queries for the admin (stock list + Dashboard summary).
 *
 * The grouped list, stock-movement timelines, CSV export and the standalone availability
 * toggles were removed 2026-07-15 (AUD-056, owner decision #8): no internal caller since the
 * standalone "Kho hàng" screen was dropped (2026-06-23) — Còn/Hết is toggled inside the
 * product edit form and persisted through the product upsert (products.update).
 */
@Service
@RequiredArgsConstructor
public class AdminInventoryService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final ProductJpaRepository productRepo;
    private final ProductVariantJpaRepository variantRepo;

    // ── List stock (DB-side filter + sort + pagination) ───────────────────────

    @Transactional(readOnly = true)
    public PageResult<AdminStockItemResponse> listStock(
            int page, int size, String q, String stockState
    ) {
        int pg = Math.max(1, page) - 1;
        int sz = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        String qParam = (q == null || q.isBlank()) ? "" : q.strip();
        ProductStockState stateParam = parseState(stockState);

        List<AdminStockItemResponse> variantItems = variantRepo
                .searchStockAll(qParam, stateParam, PublishStatus.TRASH)
                .stream().map(AdminInventoryMapper::toStockItem).toList();

        List<AdminStockItemResponse> productItems = productRepo
                .searchNoVariantStock(qParam, stateParam, PublishStatus.TRASH)
                .stream().map(AdminInventoryMapper::toProductStockItem).toList();

        List<AdminStockItemResponse> allItems = new ArrayList<>(productItems.size() + variantItems.size());
        allItems.addAll(productItems);
        allItems.addAll(variantItems);
        allItems.sort(Comparator.comparing(AdminStockItemResponse::productName, String.CASE_INSENSITIVE_ORDER));

        int total = allItems.size();
        int fromIdx = pg * sz;
        int toIdx = Math.min(fromIdx + sz, total);
        List<AdminStockItemResponse> pageItems = fromIdx >= total ? List.of() : allItems.subList(fromIdx, toIdx);
        int totalPages = total == 0 ? 1 : (int) Math.ceil((double) total / sz);

        return new PageResult<>(pageItems, page, sz, total, totalPages);
    }

    // ── Inventory summary ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public InventorySummaryResponse getSummary() {
        long variantTotal      = variantRepo.count();
        long variantOutOfStock = variantRepo.countByStockState(ProductStockState.OUT_OF_STOCK);

        long productTotal      = productRepo.countNoVariantStock(PublishStatus.TRASH);
        long productOutOfStock = productRepo.countNoVariantStockByState(PublishStatus.TRASH, ProductStockState.OUT_OF_STOCK);

        long total      = variantTotal + productTotal;
        long outOfStock = variantOutOfStock + productOutOfStock;

        return new InventorySummaryResponse(
                total,
                total - outOfStock,
                outOfStock
        );
    }
}
