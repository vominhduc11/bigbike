package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.inventory.AddSerialsRequest;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminSerialResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.UpdateSerialStatusRequest;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.catalog.ProductSerialStatus;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSerialEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductSerialJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminSerialService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final ProductSerialJpaRepository serialRepo;
    private final ProductVariantJpaRepository variantRepo;
    private final ProductJpaRepository productRepo;
    private final AuditLogJpaRepository auditLogRepo;

    // ── List all serials (global search) ─────────────────────────────────────

    @Transactional(readOnly = true)
    public PageResult<AdminSerialResponse> listAll(
            String q, String statusStr, String productId, int page, int size
    ) {
        int pg = Math.max(1, page) - 1;
        int sz = clampSize(size);
        String qParam = (q == null || q.isBlank()) ? null : q.strip();
        ProductSerialStatus status = parseStatus(statusStr);
        String pidParam = (productId == null || productId.isBlank()) ? null : productId.strip();
        Page<ProductSerialEntity> dbPage = serialRepo.searchAll(qParam, status, pidParam, PageRequest.of(pg, sz));
        return toPageResult(dbPage, page, sz);
    }

    // ── List serials for a variant ────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageResult<AdminSerialResponse> listForVariant(
            String variantId, String statusStr, int page, int size
    ) {
        if (!variantRepo.existsById(variantId)) {
            throw new NotFoundException("Variant not found: " + variantId);
        }
        int pg = Math.max(1, page) - 1;
        int sz = clampSize(size);
        ProductSerialStatus status = parseStatus(statusStr);
        Page<ProductSerialEntity> dbPage = status != null
                ? serialRepo.findByVariant_IdAndStatusOrderByReceivedAtDesc(variantId, status, PageRequest.of(pg, sz))
                : serialRepo.findByVariant_IdOrderByReceivedAtDesc(variantId, PageRequest.of(pg, sz));
        return toPageResult(dbPage, page, sz);
    }

    // ── List serials for a no-variant product ─────────────────────────────────

    @Transactional(readOnly = true)
    public PageResult<AdminSerialResponse> listForProduct(
            String productId, String statusStr, int page, int size
    ) {
        if (!productRepo.existsById(productId)) {
            throw new NotFoundException("Product not found: " + productId);
        }
        int pg = Math.max(1, page) - 1;
        int sz = clampSize(size);
        ProductSerialStatus status = parseStatus(statusStr);
        Page<ProductSerialEntity> dbPage = status != null
                ? serialRepo.findByProductIdNoVariantAndStatus(productId, status, PageRequest.of(pg, sz))
                : serialRepo.findByProductIdNoVariant(productId, PageRequest.of(pg, sz));
        return toPageResult(dbPage, page, sz);
    }

    // ── Get single serial ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AdminSerialResponse getSerial(UUID serialId) {
        return AdminSerialResponse.from(findOrThrow(serialId));
    }

    // ── Add serials to variant inventory ──────────────────────────────────────

    @Transactional
    public List<AdminSerialResponse> addToVariant(
            String variantId, UUID adminId, AddSerialsRequest req
    ) {
        ProductVariantEntity variant = variantRepo.findById(variantId)
                .orElseThrow(() -> new NotFoundException("Variant not found: " + variantId));

        if (!variant.isTrackSerials()) {
            variant.setTrackSerials(true);
            variantRepo.save(variant);
        }

        return persistSerials(req, variant.getProduct(), variant, adminId);
    }

    // ── Add serials to no-variant product inventory ───────────────────────────

    @Transactional
    public List<AdminSerialResponse> addToProduct(
            String productId, UUID adminId, AddSerialsRequest req
    ) {
        ProductEntity product = productRepo.findById(productId)
                .orElseThrow(() -> new NotFoundException("Product not found: " + productId));

        if (!product.getVariants().isEmpty()) {
            throw ValidationException.fromField("productId", "HAS_VARIANTS",
                    "Use variant-level serial management for products with variants.");
        }

        if (!product.isTrackSerials()) {
            product.setTrackSerials(true);
            productRepo.save(product);
        }

        return persistSerials(req, product, null, adminId);
    }

    // ── Update serial status (admin correction / inspection result) ───────────

    @Transactional
    public AdminSerialResponse updateStatus(UUID serialId, UUID adminId, UpdateSerialStatusRequest req) {
        ProductSerialEntity serial = findOrThrow(serialId);
        ProductSerialStatus from = serial.getStatus();
        ProductSerialStatus to = parseStatusStrict(req.status());

        validateTransition(from, to);

        serial.setStatus(to);
        serial.setUpdatedAt(Instant.now());

        if (req.note() != null && !req.note().isBlank()) {
            serial.setNote(req.note());
        }

        if (to == ProductSerialStatus.SOLD && serial.getSoldAt() == null) {
            serial.setSoldAt(Instant.now());
        }
        if (to == ProductSerialStatus.RETURNED && serial.getReturnedAt() == null) {
            serial.setReturnedAt(Instant.now());
        }
        if (to != ProductSerialStatus.RESERVED) {
            serial.setReservedUntil(null);
        }

        serialRepo.save(serial);

        String productId = serial.getProduct() != null ? serial.getProduct().getId() : "?";
        String variantId = serial.getVariant() != null ? serial.getVariant().getId() : null;
        auditLogRepo.save(buildAudit(adminId, "SERIAL_STATUS_CHANGED", "SERIAL",
                "{\"serialId\":\"" + serialId + "\"" +
                ",\"from\":\"" + from + "\",\"to\":\"" + to + "\"" +
                (variantId != null ? ",\"variantId\":\"" + variantId + "\"" : "") +
                ",\"productId\":\"" + productId + "\"}"));

        return AdminSerialResponse.from(serial);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private List<AdminSerialResponse> persistSerials(
            AddSerialsRequest req, ProductEntity product, ProductVariantEntity variant, UUID adminId
    ) {
        List<AddSerialsRequest.SerialEntry> entries = req.serials();
        validateEntries(entries);

        Instant now = Instant.now();
        List<AdminSerialResponse> result = new ArrayList<>();

        for (AddSerialsRequest.SerialEntry entry : entries) {
            ProductSerialEntity s = new ProductSerialEntity();
            s.setProduct(product);
            s.setVariant(variant);
            s.setSerialNumber(entry.serialNumber().strip());
            s.setStatus(ProductSerialStatus.IN_STOCK);
            s.setNote(req.note());
            s.setAdminId(adminId);
            s.setReceivedAt(now);
            s.setCreatedAt(now);
            s.setUpdatedAt(now);
            serialRepo.save(s);
            result.add(AdminSerialResponse.from(s));
        }

        auditLogRepo.save(buildAudit(adminId, "SERIALS_ADDED", "SERIAL",
                "{\"count\":" + entries.size() +
                ",\"productId\":\"" + product.getId() + "\"" +
                (variant != null ? ",\"variantId\":\"" + variant.getId() + "\"" : "") + "}"));

        return result;
    }

    private void validateEntries(List<AddSerialsRequest.SerialEntry> entries) {
        Set<String> seen = new HashSet<>();
        List<String> numbers = new ArrayList<>();

        for (AddSerialsRequest.SerialEntry e : entries) {
            String sn = nullIfBlank(e.serialNumber());
            if (sn == null) {
                throw ValidationException.fromField("serials", "MISSING_SERIAL_NUMBER",
                        "Each entry must have a non-blank serialNumber.");
            }
            if (!seen.add(sn)) {
                throw ValidationException.fromField("serials", "DUPLICATE_SERIAL_NUMBER",
                        "Duplicate serialNumber in request: " + sn);
            }
            numbers.add(sn);
        }

        List<String> existing = serialRepo.findExistingSerialNumbers(numbers);
        if (!existing.isEmpty()) {
            throw ValidationException.fromField("serials", "SERIAL_ALREADY_EXISTS",
                    "Serial numbers already registered: " + existing);
        }
    }

    private void validateTransition(ProductSerialStatus from, ProductSerialStatus to) {
        if (from == to) return;

        boolean allowed = switch (from) {
            case IN_STOCK   -> to == ProductSerialStatus.RESERVED
                            || to == ProductSerialStatus.DAMAGED
                            || to == ProductSerialStatus.INSPECTION
                            || to == ProductSerialStatus.SCRAPPED;
            case RESERVED   -> to == ProductSerialStatus.IN_STOCK
                            || to == ProductSerialStatus.SOLD;
            case SOLD       -> to == ProductSerialStatus.RETURNED;
            case RETURNED   -> to == ProductSerialStatus.INSPECTION;
            case INSPECTION -> to == ProductSerialStatus.IN_STOCK
                            || to == ProductSerialStatus.DAMAGED
                            || to == ProductSerialStatus.SCRAPPED;
            case DAMAGED    -> to == ProductSerialStatus.SCRAPPED;
            case SCRAPPED   -> false;
        };

        if (!allowed) {
            throw ValidationException.fromField("status", "INVALID_TRANSITION",
                    "Cannot transition serial from " + from + " to " + to +
                    ". Use 'force' endpoint for admin correction.");
        }
    }

    private ProductSerialEntity findOrThrow(UUID id) {
        return serialRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Serial not found: " + id));
    }

    private static ProductSerialStatus parseStatus(String s) {
        if (s == null || s.isBlank() || "ALL".equalsIgnoreCase(s)) return null;
        try {
            return ProductSerialStatus.valueOf(s.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static ProductSerialStatus parseStatusStrict(String s) {
        try {
            return ProductSerialStatus.valueOf(s.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ValidationException.fromField("status", "INVALID", "Unknown status: " + s);
        }
    }

    private static int clampSize(int size) {
        return (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
    }

    private static String nullIfBlank(String s) {
        if (s == null) return null;
        String t = s.strip();
        return t.isEmpty() ? null : t;
    }

    private static PageResult<AdminSerialResponse> toPageResult(Page<ProductSerialEntity> dbPage, int page, int sz) {
        List<AdminSerialResponse> items = dbPage.getContent().stream().map(AdminSerialResponse::from).toList();
        return new PageResult<>(items, page, sz, (int) dbPage.getTotalElements(), dbPage.getTotalPages());
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
