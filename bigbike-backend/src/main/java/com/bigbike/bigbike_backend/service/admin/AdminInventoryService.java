package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockProductGroupResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockVariantResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdjustStockRequest;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.InventorySummaryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.StockMovementResponse;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementEntity;
import com.bigbike.bigbike_backend.domain.catalog.ProductSerialStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSerialEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementSerialEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductSerialJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementSerialJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.inventory.InventoryPolicyService;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.time.Instant;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
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
    private static final Set<String> ALLOWED_TYPES = Set.of("IN", "OUT", "ADJUSTMENT", "RETURN");

    private final ProductJpaRepository productRepo;
    private final ProductVariantJpaRepository variantRepo;
    private final StockMovementJpaRepository movementRepo;
    private final StockMovementSerialJpaRepository serialRepo;
    private final ProductSerialJpaRepository productSerialRepo;
    private final InventoryPolicyService inventoryPolicyService;
    private final WebRevalidationService webRevalidationService;
    private final AuditLogJpaRepository auditLogRepo;

    // ── List stock (DB-side filter + sort + pagination) ───────────────────────

    public PageResult<AdminStockItemResponse> listStock(
            int page, int size, String q, String stockState
    ) {
        int pg = Math.max(1, page) - 1;
        int sz = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        String qParam = (q == null || q.isBlank()) ? "" : q.strip();
        ProductStockState stateParam = parseState(stockState);

        List<AdminStockItemResponse> variantItems = variantRepo
                .searchStockAll(qParam, stateParam, PublishStatus.TRASH)
                .stream().map(this::toStockItem).toList();

        List<AdminStockItemResponse> productItems = productRepo
                .searchNoVariantStock(qParam, stateParam, PublishStatus.TRASH)
                .stream().map(this::toProductStockItem).toList();

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

    public InventorySummaryResponse getSummary() {
        long variantTotal      = variantRepo.count();
        long variantOutOfStock = variantRepo.countByStockState(ProductStockState.OUT_OF_STOCK);
        long variantLowStock   = variantRepo.countByStockState(ProductStockState.LOW_STOCK);

        long productTotal      = productRepo.countNoVariantStock(PublishStatus.TRASH);
        long productOutOfStock = productRepo.countNoVariantStockByState(PublishStatus.TRASH, ProductStockState.OUT_OF_STOCK);
        long productLowStock   = productRepo.countNoVariantStockByState(PublishStatus.TRASH, ProductStockState.LOW_STOCK);

        return new InventorySummaryResponse(
                variantTotal + productTotal,
                variantOutOfStock + productOutOfStock,
                variantLowStock + productLowStock
        );
    }

    // ── CSV export ────────────────────────────────────────────────────────────

    private static final int CSV_CHUNK_SIZE = 500;

    public void exportCsv(HttpServletResponse response) throws IOException {
        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename=\"inventory.csv\"");

        PrintWriter writer = response.getWriter();
        writer.println("productName,productSku,variantName,variantSku,stockState,quantityOnHand,retailPrice");

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
                    v.getQuantityOnHand() + "," +
                    (v.getRetailPrice() != null ? v.getRetailPrice().toPlainString() : "")
            ));
            page++;
        } while (chunk.hasNext());

        // Export no-variant product items
        productRepo.searchNoVariantStock("", null, PublishStatus.TRASH).forEach(p -> writer.println(
                csvEscape(p.getName()) + "," +
                csvEscape(p.getSku()) + ",,," +
                (p.getStockState() != null ? p.getStockState().name() : "") + "," +
                (p.getStockQuantity() != null ? p.getStockQuantity() : 0) + "," +
                (p.getRetailPrice() != null ? p.getRetailPrice().toPlainString() : "")
        ));

        writer.flush();
    }

    // ── Adjust stock ──────────────────────────────────────────────────────────

    @Transactional
    public AdminStockItemResponse adjustStock(String variantId, UUID adminId, AdjustStockRequest req) {
        ProductVariantEntity variant = variantRepo.findByIdForUpdate(variantId)
                .orElseThrow(() -> new NotFoundException("Variant not found: " + variantId));

        // Guard: reject adjustment for variants belonging to TRASH products
        if (variant.getProduct() != null
                && variant.getProduct().getPublishStatus() != null
                && variant.getProduct().getPublishStatus().name().equals("TRASH")) {
            throw ValidationException.fromField("variantId", "TRASH_PRODUCT",
                    "Cannot adjust stock for a variant belonging to a trashed product.");
        }

        // Guard: system-wide serial-only mode — checked first; higher-level policy than per-variant flag
        if (inventoryPolicyService.isSerialInventoryOnlyEnabled()) {
            throw ValidationException.fromField("variantId", "SERIAL_INVENTORY_ONLY",
                    "Manual quantity adjustment is disabled. Use serial import/status transition. " +
                    "(serial_inventory_only=true in site_settings)");
        }

        if (req.quantityDelta() == null) {
            throw ValidationException.fromField("quantityDelta", "REQUIRED", "quantityDelta is required.");
        }

        String type = req.movementType() != null
                ? req.movementType().toUpperCase(Locale.ROOT) : "ADJUSTMENT";
        if (!ALLOWED_TYPES.contains(type)) {
            throw ValidationException.fromField("movementType", "INVALID",
                    "movementType must be one of: IN, OUT, ADJUSTMENT, RETURN.");
        }

        int before = variant.getQuantityOnHand();
        int after = before + req.quantityDelta();
        if (after < 0) {
            throw ValidationException.fromField("quantityDelta", "BELOW_ZERO",
                    "Resulting quantity would be negative. Current: " + before + ", delta: " + req.quantityDelta());
        }

        // ── Serial validation ─────────────────────────────────────────────────
        List<String> serials = parseSerials(req.serialNumbers());

        if ("IN".equals(type) && req.quantityDelta() > 0 && serials.isEmpty()) {
            throw ValidationException.fromField("serialNumbers", "REQUIRED_FOR_STOCK_IN",
                    "Serial numbers are required for stock-in movements.");
        }

        // Serials are optional for non-tracked variants; if provided, count must not exceed quantity.
        if (!serials.isEmpty()) {
            int qty = Math.abs(req.quantityDelta());
            if (serials.size() > qty) {
                throw ValidationException.fromField("serialNumbers", "COUNT_EXCEEDS_QUANTITY",
                        "Serial count (" + serials.size() + ") exceeds quantity (" + qty + ").");
            }
        }

        // No duplicates in DB — check product_serials (the authoritative serial table).
        if (!serials.isEmpty()) {
            List<String> existing = productSerialRepo.findExistingSerialNumbers(serials);
            if (!existing.isEmpty()) {
                throw ValidationException.fromField("serialNumbers", "ALREADY_EXISTS",
                        "Serial numbers already registered: " + existing);
            }
        }

        // ── Persist stock change + movement (same transaction) ────────────────
        if (!serials.isEmpty() && !variant.isTrackSerials()) {
            variant.setTrackSerials(true);
        }
        variant.setQuantityOnHand(after);
        inventoryPolicyService.recomputeStockState(variant);
        variantRepo.save(variant);

        StockMovementEntity movement = new StockMovementEntity();
        movement.setVariant(variant);
        movement.setMovementType(type);
        movement.setQuantityDelta(req.quantityDelta());
        movement.setQuantityBefore(before);
        movement.setQuantityAfter(after);
        movement.setReferenceType("MANUAL");
        movement.setNote(req.note());
        movement.setAdminId(adminId);
        movement.setCreatedAt(Instant.now());
        movementRepo.save(movement);

        auditLogRepo.save(buildAudit(adminId, "INVENTORY_STOCK_ADJUSTED", "INVENTORY",
                "{\"variantId\":\"" + variantId + "\",\"type\":\"" + type + "\"" +
                ",\"delta\":" + req.quantityDelta() + ",\"before\":" + before + ",\"after\":" + after + "}"));

        // ── Persist serials (same transaction — rollback if this fails) ────────
        if (!serials.isEmpty()) {
            Instant now = Instant.now();
            ProductEntity product = variant.getProduct();
            for (String s : serials) {
                StockMovementSerialEntity mvSerial = new StockMovementSerialEntity();
                mvSerial.setMovement(movement);
                mvSerial.setSerialNumber(s);
                mvSerial.setCreatedAt(now);
                serialRepo.save(mvSerial);

                ProductSerialEntity ps = new ProductSerialEntity();
                ps.setProduct(product);
                ps.setVariant(variant);
                ps.setSerialNumber(s);
                ps.setStatus(ProductSerialStatus.IN_STOCK);
                ps.setReceivedAt(now);
                ps.setAdminId(adminId);
                ps.setCreatedAt(now);
                ps.setUpdatedAt(now);
                productSerialRepo.save(ps);
            }
        }

        String slug = variant.getProduct() != null ? variant.getProduct().getSlug() : null;
        if (slug != null && !slug.isBlank()) {
            webRevalidationService.revalidate("product:" + slug, "products");
        }

        return toStockItem(variant);
    }

    // ── Adjust product-level (no-variant) stock ───────────────────────────────

    @Transactional
    public AdminStockItemResponse adjustProductStock(String productId, UUID adminId, AdjustStockRequest req) {
        ProductEntity product = productRepo.findByIdForUpdate(productId)
                .orElseThrow(() -> new NotFoundException("Product not found: " + productId));

        if (product.getPublishStatus() != null
                && product.getPublishStatus().name().equals("TRASH")) {
            throw ValidationException.fromField("productId", "TRASH_PRODUCT",
                    "Cannot adjust stock for a trashed product.");
        }

        if (inventoryPolicyService.isSerialInventoryOnlyEnabled()) {
            throw ValidationException.fromField("productId", "SERIAL_INVENTORY_ONLY",
                    "Manual quantity adjustment is disabled. Use serial import/status transition. " +
                    "(serial_inventory_only=true in site_settings)");
        }
        if (req.quantityDelta() == null) {
            throw ValidationException.fromField("quantityDelta", "REQUIRED", "quantityDelta is required.");
        }
        int delta = req.quantityDelta();

        String type = req.movementType() != null
                ? req.movementType().toUpperCase(Locale.ROOT) : "ADJUSTMENT";
        if (!ALLOWED_TYPES.contains(type)) {
            throw ValidationException.fromField("movementType", "INVALID",
                    "movementType must be one of: IN, OUT, ADJUSTMENT, RETURN.");
        }

        List<String> serials = parseSerials(req.serialNumbers());

        if (!serials.isEmpty()) {
            int qty = Math.abs(delta);
            if (serials.size() > qty) {
                throw ValidationException.fromField("serialNumbers", "COUNT_EXCEEDS_QUANTITY",
                        "Serial count (" + serials.size() + ") exceeds quantity (" + qty + ").");
            }
            List<String> existing = productSerialRepo.findExistingSerialNumbers(serials);
            if (!existing.isEmpty()) {
                throw ValidationException.fromField("serialNumbers", "ALREADY_EXISTS",
                        "Serial numbers already registered: " + existing);
            }
        }

        int before = product.getStockQuantity() != null ? product.getStockQuantity() : 0;
        int after = before + delta;
        if (after < 0) {
            throw ValidationException.fromField("quantityDelta", "BELOW_ZERO",
                    "Resulting quantity would be negative. Current: " + before + ", delta: " + delta);
        }

        if (!serials.isEmpty() && !product.isTrackSerials()) {
            product.setTrackSerials(true);
        }
        product.setStockQuantity(after);
        product.setStockState(inventoryPolicyService.computeStockState(after, inventoryPolicyService.lowStockThreshold()));
        productRepo.save(product);

        StockMovementEntity movement = new StockMovementEntity();
        movement.setProductId(product.getId());
        movement.setMovementType(type);
        movement.setQuantityDelta(delta);
        movement.setQuantityBefore(before);
        movement.setQuantityAfter(after);
        movement.setReferenceType("MANUAL");
        movement.setNote(req.note());
        movement.setAdminId(adminId);
        movement.setCreatedAt(Instant.now());
        movementRepo.save(movement);

        if (!serials.isEmpty()) {
            Instant now = Instant.now();
            for (String s : serials) {
                StockMovementSerialEntity mvSerial = new StockMovementSerialEntity();
                mvSerial.setMovement(movement);
                mvSerial.setSerialNumber(s);
                mvSerial.setCreatedAt(now);
                serialRepo.save(mvSerial);

                ProductSerialEntity ps = new ProductSerialEntity();
                ps.setProduct(product);
                ps.setSerialNumber(s);
                ps.setStatus(ProductSerialStatus.IN_STOCK);
                ps.setReceivedAt(now);
                ps.setAdminId(adminId);
                ps.setCreatedAt(now);
                ps.setUpdatedAt(now);
                productSerialRepo.save(ps);
            }
        }

        auditLogRepo.save(buildAudit(adminId, "INVENTORY_PRODUCT_STOCK_ADJUSTED", "INVENTORY",
                "{\"productId\":\"" + productId + "\",\"type\":\"" + type + "\"" +
                ",\"delta\":" + delta + ",\"before\":" + before + ",\"after\":" + after + "}"));

        String slug = product.getSlug();
        if (slug != null && !slug.isBlank()) {
            webRevalidationService.revalidate("product:" + slug, "products");
        }

        return toProductStockItem(product);
    }

    // ── List stock grouped by product ─────────────────────────────────────────

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
                .map(this::toProductGroup)
                .toList();

        return new PageResult<>(groups, page, sz, totalItems, totalPages);
    }

    private AdminStockProductGroupResponse toProductGroup(ProductEntity p) {
        List<ProductVariantEntity> variants = p.getVariants() != null ? p.getVariants() : List.of();

        AdminStockItemResponse.ImageRef img = buildProductImageRef(p);

        if (variants.isEmpty()) {
            return new AdminStockProductGroupResponse(
                    p.getId(), p.getName(), p.getSku(), img,
                    p.getStockState() != null ? p.getStockState().name() : "UNKNOWN",
                    p.getStockQuantity() != null ? p.getStockQuantity() : 0,
                    p.getRetailPrice(),
                    Boolean.TRUE.equals(p.getForceOutOfStock()),
                    true,
                    p.isTrackSerials(),
                    List.of()
            );
        }

        List<AdminStockVariantResponse> variantDtos = variants.stream()
                .map(v -> new AdminStockVariantResponse(
                        v.getId(), v.getName(), v.getSku(),
                        v.getStockState() != null ? v.getStockState().name() : "UNKNOWN",
                        v.getQuantityOnHand(),
                        v.getRetailPrice(),
                        v.isTrackSerials()
                ))
                .toList();

        String aggregateState = computeAggregateState(variants);
        int totalQty = variants.stream().mapToInt(v -> v.getQuantityOnHand()).sum();
        BigDecimal minPrice = variants.stream()
                .map(v -> v.getRetailPrice())
                .filter(Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(p.getRetailPrice());

        return new AdminStockProductGroupResponse(
                p.getId(), p.getName(), p.getSku(), img,
                aggregateState, totalQty, minPrice,
                Boolean.TRUE.equals(p.getForceOutOfStock()),
                false,
                false,
                variantDtos
        );
    }

    private String computeAggregateState(List<ProductVariantEntity> variants) {
        boolean anyOut = variants.stream().anyMatch(v -> v.getStockState() == ProductStockState.OUT_OF_STOCK);
        if (anyOut) return "OUT_OF_STOCK";
        boolean anyLow = variants.stream().anyMatch(v -> v.getStockState() == ProductStockState.LOW_STOCK);
        if (anyLow) return "LOW_STOCK";
        return "IN_STOCK";
    }

    private AdminStockItemResponse.ImageRef buildProductImageRef(ProductEntity p) {
        String url = trimToNull(p.getImageUrl());
        if (url == null) return null;
        return new AdminStockItemResponse.ImageRef(
                trimToNull(p.getImageId()), url, trimToNull(p.getImageAlt()),
                p.getImageWidth(), p.getImageHeight(), trimToNull(p.getImageMimeType())
        );
    }

    private ProductStockState parseState(String stockState) {
        if (stockState == null || stockState.isBlank() || "ALL".equalsIgnoreCase(stockState)) return null;
        try { return ProductStockState.valueOf(stockState.toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException ignored) { return null; }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Trim, de-blank, and de-duplicate serial numbers from the request.
     * Throws ValidationException if duplicates are found within the list.
     */
    private List<String> parseSerials(List<String> raw) {
        if (raw == null || raw.isEmpty()) return List.of();

        List<String> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        for (String entry : raw) {
            if (entry == null) continue;
            String trimmed = entry.strip();
            if (trimmed.isEmpty()) continue;
            if (!seen.add(trimmed)) {
                throw ValidationException.fromField("serialNumbers", "DUPLICATE_IN_REQUEST",
                        "Duplicate serial number in request: " + trimmed);
            }
            result.add(trimmed);
        }
        return result;
    }

    private AdminStockItemResponse toProductStockItem(ProductEntity p) {
        AdminStockItemResponse.ImageRef img = null;
        String url = trimToNull(p.getImageUrl());
        if (url != null) {
            img = new AdminStockItemResponse.ImageRef(
                    trimToNull(p.getImageId()),
                    url,
                    trimToNull(p.getImageAlt()),
                    p.getImageWidth(),
                    p.getImageHeight(),
                    trimToNull(p.getImageMimeType())
            );
        }
        return new AdminStockItemResponse(
                p.getId(),
                p.getName(),
                p.getSku(),
                img,
                null,
                null,
                null,
                p.getStockState() != null ? p.getStockState().name() : "UNKNOWN",
                p.getStockQuantity() != null ? p.getStockQuantity() : 0,
                p.getRetailPrice(),
                p.isTrackSerials(),
                Boolean.TRUE.equals(p.getForceOutOfStock())
        );
    }

    private AdminStockItemResponse toStockItem(ProductVariantEntity v) {
        return new AdminStockItemResponse(
                v.getProduct().getId(),
                v.getProduct().getName(),
                v.getProduct().getSku(),
                imageRef(v),
                v.getId(),
                v.getName(),
                v.getSku(),
                v.getStockState() != null ? v.getStockState().name() : "UNKNOWN",
                v.getQuantityOnHand(),
                v.getRetailPrice(),
                v.isTrackSerials(),
                Boolean.TRUE.equals(v.getProduct().getForceOutOfStock())
        );
    }

    private AdminStockItemResponse.ImageRef imageRef(ProductVariantEntity v) {
        String variantUrl = trimToNull(v.getImageUrl());
        if (variantUrl != null) {
            return new AdminStockItemResponse.ImageRef(
                    trimToNull(v.getImageId()),
                    variantUrl,
                    trimToNull(v.getImageAlt()),
                    v.getImageWidth(),
                    v.getImageHeight(),
                    trimToNull(v.getImageMimeType())
            );
        }

        var product = v.getProduct();
        if (product == null) {
            return null;
        }

        String productUrl = trimToNull(product.getImageUrl());
        if (productUrl == null) {
            return null;
        }

        return new AdminStockItemResponse.ImageRef(
                trimToNull(product.getImageId()),
                productUrl,
                trimToNull(product.getImageAlt()),
                product.getImageWidth(),
                product.getImageHeight(),
                trimToNull(product.getImageMimeType())
        );
    }

    private StockMovementResponse toMovementResponse(StockMovementEntity m) {
        long serialCount = serialRepo.countByMovementId(m.getId());
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
                serialCount,
                productName,
                variantName,
                variantSku
        );
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String csvEscape(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private AuditLogEntity buildAudit(UUID actorId, String action, String resourceType, String afterData) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(actorId);
        log.setAction(action);
        log.setResourceType(resourceType);
        log.setAfterData(afterData);
        log.setCreatedAt(Instant.now());
        return log;
    }
}
