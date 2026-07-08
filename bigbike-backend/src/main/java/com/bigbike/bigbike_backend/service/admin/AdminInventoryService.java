package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockProductGroupResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.InventorySummaryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.StockMovementResponse;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementJpaRepository;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.inventory.InventoryPolicyService;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import static com.bigbike.bigbike_backend.service.admin.AdminInventoryMapper.csvEscape;
import static com.bigbike.bigbike_backend.service.admin.AdminInventoryMapper.parseState;
import static com.bigbike.bigbike_backend.service.admin.AdminInventoryMapper.toProductGroup;
import static com.bigbike.bigbike_backend.service.admin.AdminInventoryMapper.toProductStockItem;
import static com.bigbike.bigbike_backend.service.admin.AdminInventoryMapper.toStockItem;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminInventoryService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final ProductJpaRepository productRepo;
    private final ProductVariantJpaRepository variantRepo;
    private final StockMovementJpaRepository movementRepo;
    private final InventoryPolicyService inventoryPolicyService;
    private final WebRevalidationService webRevalidationService;
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;

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

    // ── Stock movements — per variant ────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageResult<StockMovementResponse> listMovements(
            String variantId, int page, int size
    ) {
        if (!variantRepo.existsById(variantId)) {
            throw new NotFoundException("Variant not found: " + variantId);
        }
        int pg = Math.max(1, page);
        int sz = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
        long total = movementRepo.countByVariantId(variantId);

        List<StockMovementResponse> items = movementRepo
                .findByVariantIdOrderByCreatedAtDesc(variantId, PageRequest.of(pg - 1, sz))
                .stream().map(this::toMovementResponse).toList();

        return new PageResult<>(items, pg, sz, (int) total, (int) Math.ceil((double) total / sz));
    }

    // ── Stock movements — per product (variant-level + product-level combined) ─

    @Transactional(readOnly = true)
    public PageResult<StockMovementResponse> listProductMovements(
            String productId, int page, int size
    ) {
        if (!productRepo.existsById(productId)) {
            throw new NotFoundException("Product not found: " + productId);
        }
        int pg = Math.max(1, page);
        int sz = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
        long total = movementRepo.countByProductScope(productId);

        List<StockMovementResponse> items = movementRepo
                .findByProductScopeOrderByCreatedAtDesc(productId, PageRequest.of(pg - 1, sz))
                .stream().map(this::toMovementResponse).toList();

        return new PageResult<>(items, pg, sz, (int) total, (int) Math.ceil((double) total / sz));
    }

    // ── All movements timeline ────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageResult<StockMovementResponse> listAllMovements(
            int page, int size, String movementType, String referenceType
    ) {
        int pg = Math.max(1, page) - 1;
        int sz = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        String typeParam = (movementType == null || movementType.isBlank()) ? null
                : movementType.toUpperCase(Locale.ROOT);
        String refParam = (referenceType == null || referenceType.isBlank()) ? null
                : referenceType.toUpperCase(Locale.ROOT);

        Page<StockMovementEntity> dbPage = movementRepo.searchMovements(typeParam, refParam, PageRequest.of(pg, sz));
        List<StockMovementResponse> items = dbPage.getContent().stream().map(this::toMovementResponse).toList();

        return new PageResult<>(items, page, sz, (int) dbPage.getTotalElements(), dbPage.getTotalPages());
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

    // ── CSV export ────────────────────────────────────────────────────────────

    private static final int CSV_CHUNK_SIZE = 500;

    @Transactional(readOnly = true)
    public void exportCsv(HttpServletResponse response) throws IOException {
        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename=\"inventory.csv\"");

        PrintWriter writer = response.getWriter();
        writer.println("productName,productSku,variantName,variantSku,stockState,retailPrice");

        // Export variant items (chunked to avoid OOM)
        int page = 0;
        Page<ProductVariantEntity> chunk;
        do {
            chunk = variantRepo.searchStock("", null, PublishStatus.TRASH, PageRequest.of(page, CSV_CHUNK_SIZE));
            chunk.getContent().forEach(v -> writer.println(
                    csvEscape(v.getProduct().getName()) + "," +
                    csvEscape(v.getProduct().getSku()) + "," +
                    csvEscape(v.getName()) + "," +
                    csvEscape(v.getSku()) + "," +
                    (v.getStockState() != null ? v.getStockState().name() : "") + "," +
                    (v.getRetailPrice() != null ? v.getRetailPrice().toPlainString() : "")
            ));
            page++;
        } while (chunk.hasNext());

        // Export no-variant product items
        productRepo.searchNoVariantStock("", null, PublishStatus.TRASH).forEach(p -> writer.println(
                csvEscape(p.getName()) + "," +
                csvEscape(p.getSku()) + ",,," +
                (p.getStockState() != null ? p.getStockState().name() : "") + "," +
                (p.getRetailPrice() != null ? p.getRetailPrice().toPlainString() : "")
        ));

        writer.flush();
    }

    // ── Set availability (boolean toggle — owner decision 2026-06-23) ──────────

    @Transactional
    public AdminStockItemResponse setVariantAvailability(String variantId, UUID adminId, boolean available) {
        ProductVariantEntity variant = variantRepo.findByIdForUpdate(variantId)
                .orElseThrow(() -> new NotFoundException("Variant not found: " + variantId));

        // Guard: reject toggle for variants belonging to TRASH products
        if (variant.getProduct() != null
                && variant.getProduct().getPublishStatus() != null
                && variant.getProduct().getPublishStatus().name().equals("TRASH")) {
            throw ValidationException.fromField("variantId", "TRASH_PRODUCT",
                    "Cannot change availability for a variant belonging to a trashed product.");
        }

        variant.setAvailable(available);
        inventoryPolicyService.recomputeStockState(variant);
        variantRepo.save(variant);

        ProductEntity product = variant.getProduct();
        if (product != null) {
            inventoryPolicyService.recomputeProductStateFromVariants(product);
            productRepo.save(product);
        }

        auditLogWriter.save(auditLogFactory.build(
                "ADMIN",
                adminId,
                "INVENTORY_AVAILABILITY_SET",
                "INVENTORY",
                null,
                null,
                "{\"variantId\":\"" + variantId + "\",\"available\":" + available + "}"));

        String slug = product != null ? product.getSlug() : null;
        if (slug != null && !slug.isBlank()) {
            webRevalidationService.revalidate("product:" + slug, "products");
        }

        return toStockItem(variant);
    }

    @Transactional
    public AdminStockItemResponse setProductAvailability(String productId, UUID adminId, boolean available) {
        ProductEntity product = productRepo.findByIdForUpdate(productId)
                .orElseThrow(() -> new NotFoundException("Product not found: " + productId));

        if (product.getPublishStatus() != null
                && product.getPublishStatus().name().equals("TRASH")) {
            throw ValidationException.fromField("productId", "TRASH_PRODUCT",
                    "Cannot change availability for a trashed product.");
        }

        // Guard: a product with variants has no single "product toggle" — each variant has its own
        // availability, aggregated up via InventoryPolicyService. Setting stockState directly here
        // would bypass that aggregate and let it drift out of sync with the variants.
        if (product.getVariants() != null && !product.getVariants().isEmpty()) {
            throw ValidationException.fromField("productId", "HAS_VARIANTS",
                    "Cannot toggle availability directly on a product that has variants; toggle each variant instead.");
        }

        product.setStockState(available
                ? ProductStockState.IN_STOCK
                : ProductStockState.OUT_OF_STOCK);
        productRepo.save(product);

        auditLogWriter.save(auditLogFactory.build(
                "ADMIN",
                adminId,
                "INVENTORY_AVAILABILITY_SET",
                "INVENTORY",
                null,
                null,
                "{\"productId\":\"" + productId + "\",\"available\":" + available + "}"));

        String slug = product.getSlug();
        if (slug != null && !slug.isBlank()) {
            webRevalidationService.revalidate("product:" + slug, "products");
        }

        return toProductStockItem(product);
    }

    // ── List stock grouped by product ─────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageResult<AdminStockProductGroupResponse> listStockGrouped(
            int page, int size, String q, String stockState
    ) {
        int pg = Math.max(1, page) - 1;
        int sz = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
        String qParam = (q == null || q.isBlank()) ? "" : q.strip();
        ProductStockState stateParam = parseState(stockState);

        long withVariantCount = productRepo.countProductsWithVariantStock(qParam, stateParam, PublishStatus.TRASH);
        long noVariantCount   = productRepo.countNoVariantStockByQueryAndState(qParam, stateParam, PublishStatus.TRASH);
        long totalItems = withVariantCount + noVariantCount;
        int totalPages = totalItems == 0 ? 1 : (int) Math.ceil((double) totalItems / sz);

        if (pg * sz >= totalItems) {
            return new PageResult<>(List.of(), page, sz, totalItems, totalPages);
        }

        List<Object[]> withVariantRows = productRepo.findProductIdAndNameWithVariantStock(qParam, stateParam, PublishStatus.TRASH);
        List<Object[]> noVariantRows   = productRepo.findNoVariantProductIdAndName(qParam, stateParam, PublishStatus.TRASH);

        List<String[]> merged = new ArrayList<>(withVariantRows.size() + noVariantRows.size());
        for (Object[] row : withVariantRows) merged.add(new String[]{(String) row[0], (String) row[1]});
        for (Object[] row : noVariantRows)   merged.add(new String[]{(String) row[0], (String) row[1]});
        merged.sort((a, b) -> a[1].compareToIgnoreCase(b[1]));

        int fromIdx = pg * sz;
        int toIdx = Math.min(fromIdx + sz, merged.size());
        List<String> pageIds = merged.subList(fromIdx, toIdx).stream().map(e -> e[0]).toList();

        List<ProductEntity> loaded = productRepo.findByIdsWithVariants(pageIds);
        Map<String, ProductEntity> byId = new HashMap<>();
        for (ProductEntity p : loaded) byId.put(p.getId(), p);

        List<AdminStockProductGroupResponse> groups = pageIds.stream()
                .map(byId::get).filter(Objects::nonNull)
                .map(AdminInventoryMapper::toProductGroup)
                .toList();

        return new PageResult<>(groups, page, sz, totalItems, totalPages);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private StockMovementResponse toMovementResponse(StockMovementEntity m) {
        var variant = m.getVariant();
        String productName = (variant != null && variant.getProduct() != null) ? variant.getProduct().getName() : null;
        String variantName = variant != null ? variant.getName() : null;
        String variantSku  = variant != null ? variant.getSku()  : null;
        return new StockMovementResponse(
                m.getId(),
                m.getMovementType(),
                m.getQuantityDelta(),
                m.getQuantityBefore(),
                m.getQuantityAfter(),
                m.getReferenceType(),
                m.getNote(),
                m.getCreatedAt(),
                productName,
                variantName,
                variantSku
        );
    }
}
