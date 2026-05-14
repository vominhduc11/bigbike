package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.inventory.SerialImportRequest;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.SerialImportResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.SerialImportResponse.RowError;
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
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminSerialImportService {

    private final ProductSerialJpaRepository serialRepo;
    private final ProductJpaRepository productRepo;
    private final ProductVariantJpaRepository variantRepo;
    private final AuditLogJpaRepository auditLogRepo;

    public AdminSerialImportService(
            ProductSerialJpaRepository serialRepo,
            ProductJpaRepository productRepo,
            ProductVariantJpaRepository variantRepo,
            AuditLogJpaRepository auditLogRepo
    ) {
        this.serialRepo = serialRepo;
        this.productRepo = productRepo;
        this.variantRepo = variantRepo;
        this.auditLogRepo = auditLogRepo;
    }

    /**
     * Bulk import serials from an admin-provided JSON payload.
     * Runs in a single transaction by default (all-or-nothing).
     * When partialMode=true, bad rows are collected as errors and skipped; valid rows are inserted.
     */
    @Transactional
    public SerialImportResponse importSerials(SerialImportRequest req, UUID adminId) {
        if (req.rows() == null || req.rows().isEmpty()) {
            throw ValidationException.fromField("rows", "REQUIRED", "rows must not be empty.");
        }

        List<RowError> errors = new ArrayList<>();
        int inserted = 0;
        int skipped = 0;

        // Collect all serial numbers in this batch to detect intra-batch duplicates
        Set<String> batchSerials = new HashSet<>();

        // Pre-collect existing serial numbers from DB for the whole batch (single query)
        List<String> allSerialNumbers = req.rows().stream()
                .map(r -> r.serialNumber())
                .filter(s -> s != null && !s.isBlank())
                .toList();
        Set<String> existingSerials = new HashSet<>(
                allSerialNumbers.isEmpty() ? List.of() : serialRepo.findExistingSerialNumbers(allSerialNumbers));

        Instant now = Instant.now();

        for (int i = 0; i < req.rows().size(); i++) {
            var row = req.rows().get(i);
            List<RowError> rowErrors = new ArrayList<>();

            // ── Validate serial number ────────────────────────────────────────
            String sn = row.serialNumber() != null ? row.serialNumber().strip() : null;

            if (sn == null || sn.isEmpty()) {
                rowErrors.add(new RowError(i, "serialNumber", "REQUIRED",
                        "serialNumber must not be blank."));
            } else if (existingSerials.contains(sn)) {
                rowErrors.add(new RowError(i, "serialNumber", "DUPLICATE_IN_DB",
                        "Serial number already exists: " + sn));
            } else if (!batchSerials.add(sn)) {
                rowErrors.add(new RowError(i, "serialNumber", "DUPLICATE_IN_BATCH",
                        "Serial number appears more than once in this import: " + sn));
            }

            // ── Validate product/variant ──────────────────────────────────────
            if (row.productId() == null || row.productId().isBlank()) {
                rowErrors.add(new RowError(i, "productId", "REQUIRED", "productId is required."));
            }

            ProductEntity product = null;
            ProductVariantEntity variant = null;

            if (!rowErrors.stream().anyMatch(e -> e.field().equals("productId"))) {
                product = productRepo.findById(row.productId()).orElse(null);
                if (product == null) {
                    rowErrors.add(new RowError(i, "productId", "NOT_FOUND",
                            "Product not found: " + row.productId()));
                }
            }

            if (product != null && row.variantId() != null && !row.variantId().isBlank()) {
                variant = variantRepo.findByIdAndProductId(row.variantId(), row.productId()).orElse(null);
                if (variant == null) {
                    rowErrors.add(new RowError(i, "variantId", "NOT_FOUND_OR_WRONG_PRODUCT",
                            "Variant not found or does not belong to product: " + row.variantId()));
                }
            }

            // Product with variants must specify a variantId
            if (product != null && variant == null
                    && product.getVariants() != null && !product.getVariants().isEmpty()) {
                rowErrors.add(new RowError(i, "variantId", "REQUIRED_FOR_VARIANT_PRODUCT",
                        "Product has variants — variantId is required."));
            }

            // ── Handle errors ─────────────────────────────────────────────────
            if (!rowErrors.isEmpty()) {
                errors.addAll(rowErrors);
                if (!req.partialMode()) {
                    throw ValidationException.fromField("rows[" + i + "]", "IMPORT_VALIDATION_FAILED",
                            rowErrors.get(0).message());
                }
                skipped++;
                continue;
            }

            // ── Insert serial ─────────────────────────────────────────────────
            ProductSerialEntity serial = new ProductSerialEntity();
            serial.setProduct(product);
            serial.setVariant(variant);
            serial.setSerialNumber(sn);
            serial.setStatus(ProductSerialStatus.IN_STOCK);
            serial.setNote(row.note());
            serial.setAdminId(adminId);
            serial.setReceivedAt(now);
            serial.setCreatedAt(now);
            serial.setUpdatedAt(now);
            serialRepo.save(serial);

            // Enable serial tracking if requested
            if (row.enableTracking()) {
                if (variant != null && !variant.isTrackSerials()) {
                    variant.setTrackSerials(true);
                    variantRepo.save(variant);
                } else if (variant == null && !product.isTrackSerials()) {
                    product.setTrackSerials(true);
                    productRepo.save(product);
                }
            }

            // Add to existing set so subsequent rows in same batch see this as "existing"
            existingSerials.add(sn);

            inserted++;
        }

        AuditLogEntity audit = new AuditLogEntity();
        audit.setActorType("ADMIN");
        audit.setActorId(adminId);
        audit.setAction("SERIALS_BULK_IMPORTED");
        audit.setResourceType("SERIAL");
        audit.setAfterData("{\"requested\":" + req.rows().size()
                + ",\"inserted\":" + inserted
                + ",\"skipped\":" + skipped
                + ",\"partialMode\":" + req.partialMode() + "}");
        audit.setCreatedAt(Instant.now());
        auditLogRepo.save(audit);

        return new SerialImportResponse(inserted, skipped, errors);
    }
}
