package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdjustStockRequest;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.InventorySummaryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.StockMovementResponse;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementSerialEntity;
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
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminInventoryService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final Set<String> ALLOWED_TYPES = Set.of("IN", "OUT", "ADJUSTMENT", "RETURN");

    private final ProductVariantJpaRepository variantRepo;
    private final StockMovementJpaRepository movementRepo;
    private final StockMovementSerialJpaRepository serialRepo;
    private final InventoryPolicyService inventoryPolicyService;
    private final WebRevalidationService webRevalidationService;

    public AdminInventoryService(
            ProductVariantJpaRepository variantRepo,
            StockMovementJpaRepository movementRepo,
            StockMovementSerialJpaRepository serialRepo,
            InventoryPolicyService inventoryPolicyService,
            WebRevalidationService webRevalidationService
    ) {
        this.variantRepo = variantRepo;
        this.movementRepo = movementRepo;
        this.serialRepo = serialRepo;
        this.inventoryPolicyService = inventoryPolicyService;
        this.webRevalidationService = webRevalidationService;
    }

    // ── List stock (DB-side filter + sort + pagination) ───────────────────────

    public PageResult<AdminStockItemResponse> listStock(
            int page, int size, String q, String stockState
    ) {
        int pg = Math.max(1, page) - 1;
        int sz = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        // Empty string (not null) — Postgres can't infer type of null inside lower(?).
        String qParam = (q == null || q.isBlank()) ? "" : q.strip();
        ProductStockState stateParam = null;
        if (stockState != null && !stockState.isBlank() && !"ALL".equalsIgnoreCase(stockState)) {
            try { stateParam = ProductStockState.valueOf(stockState.toUpperCase(Locale.ROOT)); }
            catch (IllegalArgumentException ignored) {}
        }

        Page<ProductVariantEntity> dbPage = variantRepo.searchStock(qParam, stateParam, PageRequest.of(pg, sz));
        List<AdminStockItemResponse> items = dbPage.getContent().stream().map(this::toStockItem).toList();

        return new PageResult<>(items, page, sz, (int) dbPage.getTotalElements(), dbPage.getTotalPages());
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
        long total = variantRepo.count();
        long outOfStock = variantRepo.countByStockState(ProductStockState.OUT_OF_STOCK);
        long lowStock = variantRepo.countByStockState(ProductStockState.LOW_STOCK);
        return new InventorySummaryResponse(total, outOfStock, lowStock);
    }

    // ── CSV export ────────────────────────────────────────────────────────────

    private static final int CSV_CHUNK_SIZE = 500;

    public void exportCsv(HttpServletResponse response) throws IOException {
        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename=\"inventory.csv\"");

        PrintWriter writer = response.getWriter();
        writer.println("productName,productSku,variantName,variantSku,stockState,quantityOnHand,retailPrice");

        int page = 0;
        Page<ProductVariantEntity> chunk;
        do {
            chunk = variantRepo.searchStock("", null, PageRequest.of(page, CSV_CHUNK_SIZE));
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

        writer.flush();
    }

    // ── Adjust stock ──────────────────────────────────────────────────────────

    @Transactional
    public AdminStockItemResponse adjustStock(String variantId, UUID adminId, AdjustStockRequest req) {
        ProductVariantEntity variant = variantRepo.findByIdForUpdate(variantId)
                .orElseThrow(() -> new NotFoundException("Variant not found: " + variantId));

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

        if ("IN".equals(type)) {
            // Stock-in: serials are REQUIRED and count must match quantityDelta exactly.
            if (serials.isEmpty()) {
                throw ValidationException.fromField("serialNumbers", "REQUIRED_FOR_STOCK_IN",
                        "Serial numbers are required for stock-in movements.");
            }
            int qty = req.quantityDelta();
            if (serials.size() != qty) {
                throw ValidationException.fromField("serialNumbers", "COUNT_MISMATCH",
                        "Serial count (" + serials.size() + ") must equal quantity (" + qty + ").");
            }
        } else if (!serials.isEmpty()) {
            // Other movement types: serial optional, count must not exceed quantity.
            int qty = Math.abs(req.quantityDelta());
            if (serials.size() > qty) {
                throw ValidationException.fromField("serialNumbers", "COUNT_EXCEEDS_QUANTITY",
                        "Serial count (" + serials.size() + ") exceeds quantity (" + qty + ").");
            }
        }

        // No duplicates in DB (applies to all movement types when serials present).
        if (!serials.isEmpty()) {
            List<String> existing = serialRepo.findExistingSerialNumbers(serials);
            if (!existing.isEmpty()) {
                throw ValidationException.fromField("serialNumbers", "ALREADY_EXISTS",
                        "Serial numbers already registered: " + existing);
            }
        }

        // ── Persist stock change + movement (same transaction) ────────────────
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

        // ── Persist serials (same transaction — rollback if this fails) ────────
        if (!serials.isEmpty()) {
            Instant now = Instant.now();
            for (String s : serials) {
                StockMovementSerialEntity serial = new StockMovementSerialEntity();
                serial.setMovement(movement);
                serial.setSerialNumber(s);
                serial.setCreatedAt(now);
                serialRepo.save(serial);
            }
        }

        String slug = variant.getProduct() != null ? variant.getProduct().getSlug() : null;
        if (slug != null && !slug.isBlank()) {
            webRevalidationService.revalidate("product:" + slug, "products");
        }

        return toStockItem(variant);
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
                v.getRetailPrice()
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
}
