package com.bigbike.bigbike_backend.service.inventory;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.ProductSerialStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.OrderLineItemSerialEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSerialEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReturnItemSerialEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.warranty.WarrantyRecordEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.OrderLineItemSerialJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductSerialJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReturnItemSerialJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.returns.ReturnItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.warranty.WarrantyRecordJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Single authoritative source for all serial lifecycle transitions in sale flows.
 * Rules:
 *   - Never sets quantity_on_hand directly — the DB trigger fn_sync_qty_from_serial_lifecycle handles sync.
 *   - All methods are idempotent: calling twice for the same order/return is safe.
 *   - Row-level pessimistic locks used via native SKIP LOCKED queries for concurrency safety.
 */
@Service
public class SerialLifecycleService {

    private static final Logger log = LoggerFactory.getLogger(SerialLifecycleService.class);

    private static final Duration DEFAULT_RESERVATION_TTL = Duration.ofMinutes(15);
    private static final int DEFAULT_WARRANTY_MONTHS = 12;

    private final ProductSerialJpaRepository serialRepo;
    private final OrderLineItemSerialJpaRepository olisRepo;
    private final ReturnItemSerialJpaRepository risRepo;
    private final StockMovementJpaRepository stockMovementRepo;
    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final ReturnItemJpaRepository returnItemRepo;
    private final WarrantyRecordJpaRepository warrantyRepo;
    private final SiteSettingJpaRepository settingRepo;

    public SerialLifecycleService(
            ProductSerialJpaRepository serialRepo,
            OrderLineItemSerialJpaRepository olisRepo,
            ReturnItemSerialJpaRepository risRepo,
            StockMovementJpaRepository stockMovementRepo,
            OrderJpaRepository orderRepo,
            OrderLineItemJpaRepository lineItemRepo,
            ReturnItemJpaRepository returnItemRepo,
            WarrantyRecordJpaRepository warrantyRepo,
            SiteSettingJpaRepository settingRepo
    ) {
        this.serialRepo = serialRepo;
        this.olisRepo = olisRepo;
        this.risRepo = risRepo;
        this.stockMovementRepo = stockMovementRepo;
        this.orderRepo = orderRepo;
        this.lineItemRepo = lineItemRepo;
        this.returnItemRepo = returnItemRepo;
        this.warrantyRepo = warrantyRepo;
        this.settingRepo = settingRepo;
    }

    // ── 1. Reserve serials for an order line item ────────────────────────────

    /**
     * Picks the required number of IN_STOCK serials for the given variant/product,
     * transitions them to RESERVED, and creates bridge records in order_line_item_serials.
     *
     * Uses FOR UPDATE SKIP LOCKED so concurrent checkouts cannot double-reserve.
     * Throws ConflictException if stock is insufficient — caller must rollback.
     */
    @Transactional
    public void reserveForOrderLine(OrderLineItemEntity lineItem,
                                    String productId,
                                    String variantId,
                                    int quantity,
                                    Instant reservedUntil) {
        // Idempotent: already reserved for this line item → skip
        if (olisRepo.findByOrderLineItemId(lineItem.getId()).size() >= quantity) {
            return;
        }

        List<ProductSerialEntity> candidates;
        if (variantId != null) {
            candidates = serialRepo.findAvailableForVariantWithLock(variantId, quantity);
        } else {
            candidates = serialRepo.findAvailableForProductNoVariantWithLock(productId, quantity);
        }

        if (candidates.size() < quantity) {
            throw new ConflictException(
                    "Không đủ serial khả dụng. Yêu cầu: " + quantity +
                    ", khả dụng: " + candidates.size() + ".");
        }

        Instant now = Instant.now();
        for (ProductSerialEntity serial : candidates) {
            serial.setStatus(ProductSerialStatus.RESERVED);
            serial.setReservedUntil(reservedUntil);
            serial.setOrderLineItemId(lineItem.getId());
            serial.setUpdatedAt(now);
            serialRepo.save(serial);

            OrderLineItemSerialEntity bridge = new OrderLineItemSerialEntity();
            bridge.setOrderLineItemId(lineItem.getId());
            bridge.setSerialId(serial.getId());
            bridge.setCreatedAt(now);
            olisRepo.save(bridge);

            writeStockMovement(serial, ProductSerialStatus.IN_STOCK, ProductSerialStatus.RESERVED,
                    "ORDER_RESERVE", lineItem.getOrder() != null ? lineItem.getOrder().getId() : null, now);
        }
    }

    // ── 2. Mark serials SOLD on order completion ─────────────────────────────

    /**
     * Transitions all RESERVED serials for the order to SOLD and creates warranty records.
     * Idempotent: already SOLD serials are left unchanged.
     */
    @Transactional
    public void markSoldForOrder(UUID orderId) {
        var order = orderRepo.findById(orderId).orElse(null);

        List<OrderLineItemSerialEntity> bridges = olisRepo.findByOrderId(orderId);
        if (bridges.isEmpty()) {
            return;
        }

        Instant now = Instant.now();
        int warrantyMonths = warrantyMonths();

        for (OrderLineItemSerialEntity bridge : bridges) {
            serialRepo.findById(bridge.getSerialId()).ifPresent(serial -> {
                if (serial.getStatus() == ProductSerialStatus.SOLD) return; // idempotent

                ProductSerialStatus from = serial.getStatus();
                serial.setStatus(ProductSerialStatus.SOLD);
                serial.setSoldAt(now);
                serial.setReservedUntil(null);
                serial.setUpdatedAt(now);
                serialRepo.save(serial);

                writeStockMovement(serial, from, ProductSerialStatus.SOLD,
                        "ORDER_COMPLETED", orderId, now);

                // Create warranty record if not already present
                if (!warrantyRepo.existsBySerialId(serial.getId())) {
                    WarrantyRecordEntity warranty = new WarrantyRecordEntity();
                    warranty.setSerialId(serial.getId());
                    warranty.setOrderLineItemId(bridge.getOrderLineItemId());

                    if (order != null) {
                        warranty.setCustomerId(order.getCustomerId());
                        warranty.setCustomerEmail(order.getCustomerEmail());
                        warranty.setCustomerPhone(order.getCustomerPhone());
                    }

                    LocalDate startDate = now.atZone(ZoneOffset.UTC).toLocalDate();
                    warranty.setStartDate(startDate);
                    warranty.setEndDate(startDate.plusMonths(warrantyMonths));
                    warranty.setStatus("ACTIVE");
                    warranty.setCreatedAt(now);
                    warranty.setUpdatedAt(now);
                    warrantyRepo.save(warranty);
                }
            });
        }
    }

    // ── 3. Release reservation on order cancel ───────────────────────────────

    /**
     * Returns RESERVED serials to IN_STOCK when an order is cancelled.
     * Does NOT touch serials that are already SOLD (e.g., partial fulfillment edge case).
     * Idempotent: already IN_STOCK serials are skipped.
     */
    @Transactional
    public void releaseReservationForOrder(UUID orderId, String reason) {
        List<OrderLineItemSerialEntity> bridges = olisRepo.findByOrderId(orderId);
        if (bridges.isEmpty()) {
            return;
        }

        Instant now = Instant.now();
        for (OrderLineItemSerialEntity bridge : bridges) {
            serialRepo.findById(bridge.getSerialId()).ifPresent(serial -> {
                if (serial.getStatus() != ProductSerialStatus.RESERVED) return; // skip SOLD / already released

                serial.setStatus(ProductSerialStatus.IN_STOCK);
                serial.setReservedUntil(null);
                serial.setOrderLineItemId(null);
                serial.setUpdatedAt(now);
                serialRepo.save(serial);

                writeStockMovement(serial, ProductSerialStatus.RESERVED, ProductSerialStatus.IN_STOCK,
                        "ORDER_CANCEL", orderId, now);
            });
        }
    }

    // ── 4. Mark serials RETURNED on return receipt ───────────────────────────

    /**
     * Transitions SOLD serials to RETURNED when a return is physically received.
     * Does NOT add back to sellable stock — admin must pass INSPECTION first.
     * Links serials via return_item_serials bridge.
     */
    @Transactional
    public void receiveReturnForReturn(UUID returnId) {
        List<ReturnItemEntity> returnItems = returnItemRepo.findByReturnId(returnId);
        Instant now = Instant.now();

        for (ReturnItemEntity ri : returnItems) {
            // Idempotent: skip if bridge records already exist for this return item
            if (!risRepo.findByReturnItemId(ri.getId()).isEmpty()) continue;

            if (ri.getOrderLineItemId() == null) continue;

            List<OrderLineItemSerialEntity> soldBridges =
                    olisRepo.findByOrderLineItemId(ri.getOrderLineItemId());

            for (OrderLineItemSerialEntity soldBridge : soldBridges) {
                serialRepo.findById(soldBridge.getSerialId()).ifPresent(serial -> {
                    if (serial.getStatus() != ProductSerialStatus.SOLD) return;

                    serial.setStatus(ProductSerialStatus.RETURNED);
                    serial.setReturnedAt(now);
                    serial.setReturnItemId(ri.getId());
                    serial.setUpdatedAt(now);
                    serialRepo.save(serial);

                    ReturnItemSerialEntity bridge = new ReturnItemSerialEntity();
                    bridge.setReturnItemId(ri.getId());
                    bridge.setSerialId(serial.getId());
                    bridge.setCreatedAt(now);
                    risRepo.save(bridge);

                    writeStockMovement(serial, ProductSerialStatus.SOLD, ProductSerialStatus.RETURNED,
                            "RETURN_RECEIVED", returnId, now);
                });
            }
        }
    }

    // ── 5. Move RETURNED serials to INSPECTION ────────────────────────────────

    @Transactional
    public void moveReturnedToInspection(UUID returnId) {
        List<ReturnItemSerialEntity> bridges = risRepo.findByReturnId(returnId);
        Instant now = Instant.now();

        for (ReturnItemSerialEntity bridge : bridges) {
            serialRepo.findById(bridge.getSerialId()).ifPresent(serial -> {
                if (serial.getStatus() != ProductSerialStatus.RETURNED) return;

                serial.setStatus(ProductSerialStatus.INSPECTION);
                serial.setUpdatedAt(now);
                serialRepo.save(serial);

                writeStockMovement(serial, ProductSerialStatus.RETURNED, ProductSerialStatus.INSPECTION,
                        "RETURN_INSPECTION_STARTED", returnId, now);
            });
        }
    }

    // ── 6. Admin sets INSPECTION result per individual serial ─────────────────

    /**
     * Finalizes inspection for a single serial.
     * Target must be IN_STOCK, DAMAGED, or SCRAPPED.
     * note is required for DAMAGED/SCRAPPED — enforced here.
     */
    @Transactional
    public void markInspectionResult(UUID serialId, ProductSerialStatus targetStatus, String note) {
        if (targetStatus != ProductSerialStatus.IN_STOCK
                && targetStatus != ProductSerialStatus.DAMAGED
                && targetStatus != ProductSerialStatus.SCRAPPED) {
            throw new ConflictException("inspectionResult must be IN_STOCK, DAMAGED, or SCRAPPED.");
        }
        if ((targetStatus == ProductSerialStatus.DAMAGED || targetStatus == ProductSerialStatus.SCRAPPED)
                && (note == null || note.isBlank())) {
            throw new ConflictException("Lý do bắt buộc khi chuyển serial sang DAMAGED hoặc SCRAPPED.");
        }

        ProductSerialEntity serial = serialRepo.findById(serialId)
                .orElseThrow(() -> new NotFoundException("Serial not found: " + serialId));

        if (serial.getStatus() != ProductSerialStatus.INSPECTION) {
            throw new ConflictException(
                    "Serial " + serialId + " không ở trạng thái INSPECTION. Hiện tại: " + serial.getStatus());
        }

        ProductSerialStatus from = serial.getStatus();
        Instant now = Instant.now();
        serial.setStatus(targetStatus);
        serial.setNote(note);
        serial.setUpdatedAt(now);
        if (targetStatus == ProductSerialStatus.IN_STOCK) {
            serial.setReturnedAt(null);
        }
        serialRepo.save(serial);

        writeStockMovement(serial, from, targetStatus, "INSPECTION_RESULT", null, now);
    }

    // ── 7. Release expired reservations (called by scheduler) ────────────────

    /**
     * Releases all RESERVED serials whose TTL has expired,
     * but only if the linked order is not yet PROCESSING/COMPLETED/PAID.
     */
    @Transactional
    public int releaseExpiredReservations() {
        Instant now = Instant.now();
        List<ProductSerialEntity> expired = serialRepo.findExpiredReservations(now);
        int released = 0;

        for (ProductSerialEntity serial : expired) {
            // Guard: if order is paid/completed, do not release
            if (serial.getOrderLineItemId() != null) {
                var lineItem = lineItemRepo.findById(serial.getOrderLineItemId()).orElse(null);
                if (lineItem != null && lineItem.getOrder() != null) {
                    String orderStatus = lineItem.getOrder().getStatus();
                    if ("COMPLETED".equals(orderStatus) || "PROCESSING".equals(orderStatus)) {
                        log.warn("Skipping expired reservation for serial {} — order {} is {}",
                                serial.getId(), lineItem.getOrder().getId(), orderStatus);
                        continue;
                    }
                }
            }

            serial.setStatus(ProductSerialStatus.IN_STOCK);
            serial.setReservedUntil(null);
            serial.setOrderLineItemId(null);
            serial.setUpdatedAt(now);
            serialRepo.save(serial);

            writeStockMovement(serial, ProductSerialStatus.RESERVED, ProductSerialStatus.IN_STOCK,
                    "RESERVATION_EXPIRED", null, now);
            released++;
        }

        if (released > 0) {
            log.info("Released {} expired serial reservations.", released);
        }
        return released;
    }

    // ── 8. Validate serial availability for checkout (read-only check) ────────

    /**
     * Returns count of available IN_STOCK serials for a variant/product.
     * Used by checkout to validate before attempting reservation.
     */
    public long countAvailable(String productId, String variantId) {
        if (variantId != null) {
            return serialRepo.countByVariant_IdAndStatus(variantId, ProductSerialStatus.IN_STOCK);
        }
        return serialRepo.countByProduct_IdAndVariantIsNullAndStatus(productId, ProductSerialStatus.IN_STOCK);
    }

    // ── Internal: reservation TTL ─────────────────────────────────────────────

    public Instant computeReservedUntil() {
        long minutes = settingRepo.findBySettingKey("reservation_ttl_minutes")
                .map(s -> {
                    try { return Long.parseLong(s.getSettingValue()); }
                    catch (NumberFormatException e) { return 15L; }
                })
                .orElse(15L);
        return Instant.now().plus(Duration.ofMinutes(minutes));
    }

    // ── Internal: stock movement ledger entry ─────────────────────────────────

    private void writeStockMovement(ProductSerialEntity serial,
                                    ProductSerialStatus from,
                                    ProductSerialStatus to,
                                    String referenceType,
                                    UUID referenceId,
                                    Instant now) {
        StockMovementEntity m = new StockMovementEntity();
        if (serial.getVariant() != null) {
            m.setVariant(serial.getVariant());
        } else if (serial.getProduct() != null) {
            m.setProductId(serial.getProduct().getId());
        }
        // For serial lifecycle, delta = +1 when going to IN_STOCK, -1 when leaving
        int delta = (to == ProductSerialStatus.IN_STOCK) ? 1
                : (from == ProductSerialStatus.IN_STOCK) ? -1 : 0;
        m.setMovementType(delta >= 0 ? "IN" : "OUT");
        m.setQuantityDelta(delta);
        m.setQuantityBefore(0); // exact qty maintained by DB trigger; movement is a ledger entry
        m.setQuantityAfter(0);
        m.setReferenceType(referenceType);
        m.setReferenceId(referenceId);
        m.setNote("Serial " + serial.getId() + ": " + from + " → " + to);
        m.setCreatedAt(now);
        stockMovementRepo.save(m);
    }

    private int warrantyMonths() {
        return settingRepo.findBySettingKey("default_warranty_months")
                .map(s -> {
                    try { return Integer.parseInt(s.getSettingValue()); }
                    catch (NumberFormatException e) { return DEFAULT_WARRANTY_MONTHS; }
                })
                .orElse(DEFAULT_WARRANTY_MONTHS);
    }
}
