package com.bigbike.bigbike_backend.qa;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.admin.dto.returns.UpdateReturnStatusRequest;
import com.bigbike.bigbike_backend.domain.catalog.ProductSerialStatus;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.OrderLineItemSerialEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSerialEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnItemEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.OrderLineItemSerialJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductSerialJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.StockMovementJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.returns.ReturnItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.returns.ReturnJpaRepository;
import com.bigbike.bigbike_backend.service.admin.AdminReturnService;
import com.bigbike.bigbike_backend.service.inventory.OrderStockRestoreService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * BUG-2 regression — stock must be restored on cancel / FAILED / refund / completed return,
 * including for migrated WordPress catalog whose product & variant primary keys are varchar
 * strings ("wp-prod-*", "wp-var-*"), so the legacy UUID columns are null.
 *
 * <p>Real PostgreSQL via Testcontainers (Flyway runs all migrations incl. V158) — deliberately
 * NOT using {@code db/test-seed.sql}, which is schema-stale (missing products.version).
 *
 * <p>Fixtures mirror what the fixed sell paths (POS + storefront quick-buy) now snapshot:
 * {@code product_pk} / {@code product_variant_pk} set, UUID columns null — the exact shape that
 * previously made {@code OrderStockRestoreService} / {@code AdminReturnService} skip every line.
 */
@SpringBootTest
@ActiveProfiles("tc")
@Testcontainers
class QaBug2StockRestoreTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired OrderStockRestoreService orderStockRestoreService;
    @Autowired AdminReturnService adminReturnService;

    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired ProductJpaRepository productRepo;
    @Autowired ProductVariantJpaRepository variantRepo;
    @Autowired OrderJpaRepository orderRepo;
    @Autowired OrderLineItemJpaRepository lineItemRepo;
    @Autowired StockMovementJpaRepository stockMovementRepo;
    @Autowired ReturnJpaRepository returnRepo;
    @Autowired ReturnItemJpaRepository returnItemRepo;
    @Autowired ProductSerialJpaRepository serialRepo;
    @Autowired OrderLineItemSerialJpaRepository olisRepo;

    // ── 1. Full refund of a wp-* VARIANT line restores quantity_on_hand (the headline repro) ──

    @Test
    void fullRefund_wpStyleVariantLine_restoresVariantStock_andWritesInMovement() {
        ProductEntity product = saveWpProduct(false, null, false);
        ProductVariantEntity variant = saveWpVariant(product, /*qoh after selling 3 of 100*/ 97, false);

        OrderEntity order = saveOrder("REFUNDED", "REFUNDED");
        saveWpVariantLine(order, product.getId(), variant.getId(), 3);

        orderStockRestoreService.restoreForRefund(order.getId());

        ProductVariantEntity restored = variantRepo.findById(variant.getId()).orElseThrow();
        assertThat(restored.getQuantityOnHand())
                .as("variant quantity_on_hand must be restored 97 -> 100 on full refund")
                .isEqualTo(100);
        assertThat(restored.getStockState()).isEqualTo(ProductStockState.IN_STOCK);

        List<StockMovementEntity> movements =
                stockMovementRepo.findByReferenceTypeAndReferenceId("ORDER_REFUND", order.getId());
        assertThat(movements).hasSize(1);
        assertThat(movements.get(0).getMovementType()).isEqualTo("IN");
        assertThat(movements.get(0).getQuantityDelta()).isEqualTo(3);
        assertThat(movements.get(0).getQuantityAfter()).isEqualTo(100);
    }

    // ── 2. Cancel (also covers FAILED — both route to restoreForCancel) restores variant stock ──

    @Test
    void cancel_wpStyleVariantLine_restoresVariantStock_andWritesInMovement() {
        ProductEntity product = saveWpProduct(false, null, false);
        ProductVariantEntity variant = saveWpVariant(product, 8, false);

        OrderEntity order = saveOrder("CANCELLED", "UNPAID");
        saveWpVariantLine(order, product.getId(), variant.getId(), 2);

        orderStockRestoreService.restoreForCancel(order.getId());

        assertThat(variantRepo.findById(variant.getId()).orElseThrow().getQuantityOnHand())
                .as("cancel/FAILED must restore variant stock 8 -> 10 for wp-* variants")
                .isEqualTo(10);
        assertThat(stockMovementRepo.existsByReferenceTypeAndReferenceId("ORDER_CANCEL", order.getId()))
                .isTrue();
    }

    // ── 3. Product-level wp-* line (no variant) restores products.stock_quantity ──

    @Test
    void fullRefund_wpStyleProductLevelLine_restoresProductStockQuantity() {
        ProductEntity product = saveWpProduct(/*manageStock*/ true, /*stockQty after selling 4 of 50*/ 46, false);

        OrderEntity order = saveOrder("REFUNDED", "REFUNDED");
        // Product-level line: only product_pk set, no variant keys.
        OrderLineItemEntity li = newLine(order, 4);
        li.setProductPk(product.getId());
        lineItemRepo.save(li);

        orderStockRestoreService.restoreForRefund(order.getId());

        ProductEntity restored = productRepo.findById(product.getId()).orElseThrow();
        assertThat(restored.getStockQuantity())
                .as("product-level wp-* line must restore products.stock_quantity 46 -> 50")
                .isEqualTo(50);
        assertThat(stockMovementRepo.existsByReferenceTypeAndReferenceId("ORDER_REFUND", order.getId()))
                .isTrue();
    }

    // ── 4. Idempotency — a second restore for the same order does not double-restore ──

    @Test
    void fullRefund_calledTwice_isIdempotent() {
        ProductEntity product = saveWpProduct(false, null, false);
        ProductVariantEntity variant = saveWpVariant(product, 7, false);

        OrderEntity order = saveOrder("REFUNDED", "REFUNDED");
        saveWpVariantLine(order, product.getId(), variant.getId(), 3);

        orderStockRestoreService.restoreForRefund(order.getId());
        orderStockRestoreService.restoreForRefund(order.getId()); // retry

        assertThat(variantRepo.findById(variant.getId()).orElseThrow().getQuantityOnHand())
                .as("restore must be idempotent — 7 -> 10, not 13")
                .isEqualTo(10);
        assertThat(stockMovementRepo.findByReferenceTypeAndReferenceId("ORDER_REFUND", order.getId()))
                .hasSize(1);
    }

    // ── 5. Regression — regular UUID-PK variant still restores via the UUID column ──

    @Test
    void fullRefund_regularUuidVariantLine_stillRestoresViaUuidColumn() {
        ProductEntity product = saveProduct("prod-" + uniq(), false, null, false);
        // Variant whose string PK is a UUID — the "regular" (non-migrated) shape.
        UUID variantUuid = UUID.randomUUID();
        ProductVariantEntity variant = newVariant(product, variantUuid.toString(), 5, false);
        variantRepo.save(variant);

        OrderEntity order = saveOrder("REFUNDED", "REFUNDED");
        OrderLineItemEntity li = newLine(order, 5);
        li.setProductId(UUID.fromString(/*not used by restore, but realistic*/ UUID.randomUUID().toString()));
        li.setProductPk(product.getId());
        li.setProductVariantId(variantUuid); // UUID column populated (regular product)
        lineItemRepo.save(li);

        orderStockRestoreService.restoreForRefund(order.getId());

        assertThat(variantRepo.findById(variant.getId()).orElseThrow().getQuantityOnHand())
                .as("regular UUID variant must still restore via productVariantId 5 -> 10")
                .isEqualTo(10);
    }

    // ── 6. Return RECEIVED -> COMPLETED restores all received items (wp-* variant) ──

    @Test
    void returnCompleted_fromReceived_wpStyleVariant_restoresReceivedItems() {
        ProductEntity product = saveWpProduct(false, null, false);
        ProductVariantEntity variant = saveWpVariant(product, 9, false);

        OrderEntity order = saveOrder("COMPLETED", "PAID");
        OrderLineItemEntity li = saveWpVariantLine(order, product.getId(), variant.getId(), 1);

        ReturnEntity ret = saveReturn(order.getId(), "RECEIVED");
        saveReturnItem(ret.getId(), li.getId(), 1, null);

        adminReturnService.updateStatus(ret.getId(), UUID.randomUUID(),
                new UpdateReturnStatusRequest("COMPLETED", "received goods back", null));

        assertThat(variantRepo.findById(variant.getId()).orElseThrow().getQuantityOnHand())
                .as("RECEIVED -> COMPLETED must restock the received variant item 9 -> 10")
                .isEqualTo(10);
        assertThat(stockMovementRepo.existsByReferenceTypeAndReferenceId("RETURN", ret.getId()))
                .isTrue();
    }

    // ── 7. On COMPLETED, a FAIL-inspected item is NOT restocked; a non-FAIL item is ──
    //
    // The restore keys on the line's inspection_result (AdminReturnService skips "FAIL"),
    // independent of the return's own status. INSPECTING status itself is currently
    // DB-unreachable (chk_returns_status omits it — see test report follow-up), so the
    // FAIL-skip is exercised here via the allowed RECEIVED -> COMPLETED path.

    @Test
    void returnCompleted_failInspectedItem_isNotRestocked_passItemIs() {
        ProductEntity product = saveWpProduct(false, null, false);
        ProductVariantEntity passVariant = saveWpVariant(product, 4, false); // will be restocked
        ProductVariantEntity failVariant = saveWpVariant(product, 4, false); // must NOT be restocked

        OrderEntity order = saveOrder("COMPLETED", "PAID");
        OrderLineItemEntity passLine = saveWpVariantLine(order, product.getId(), passVariant.getId(), 1);
        OrderLineItemEntity failLine = saveWpVariantLine(order, product.getId(), failVariant.getId(), 1);

        ReturnEntity ret = saveReturn(order.getId(), "RECEIVED");
        saveReturnItem(ret.getId(), passLine.getId(), 1, "PASS");
        saveReturnItem(ret.getId(), failLine.getId(), 1, "FAIL");

        adminReturnService.updateStatus(ret.getId(), UUID.randomUUID(),
                new UpdateReturnStatusRequest("COMPLETED", "inspection done", null));

        assertThat(variantRepo.findById(passVariant.getId()).orElseThrow().getQuantityOnHand())
                .as("PASS item must be restocked 4 -> 5")
                .isEqualTo(5);
        assertThat(variantRepo.findById(failVariant.getId()).orElseThrow().getQuantityOnHand())
                .as("FAIL item must NOT be restocked — stays 4 (goes to scrap, not the shelf)")
                .isEqualTo(4);
    }

    // ── 8. Serial-tracked line is skipped by the non-serial restore (no double-count) ──

    @Test
    void fullRefund_serialTrackedLine_isSkippedByNonSerialRestore() {
        ProductEntity product = saveWpProduct(false, null, /*trackSerials*/ true);
        ProductVariantEntity variant = saveWpVariant(product, 50, /*trackSerials*/ true);

        OrderEntity order = saveOrder("REFUNDED", "REFUNDED");
        OrderLineItemEntity li = saveWpVariantLine(order, product.getId(), variant.getId(), 1);

        // Serial bridge: this line is serial-tracked, so quantity restore must be skipped.
        ProductSerialEntity serial = new ProductSerialEntity();
        serial.setProduct(product);
        serial.setVariant(variant);
        serial.setSerialNumber("SN-" + uniq());
        serial.setStatus(ProductSerialStatus.IN_STOCK);
        Instant now = Instant.now();
        serial.setReceivedAt(now);
        serial.setCreatedAt(now);
        serial.setUpdatedAt(now);
        serial.setOrderLineItemId(li.getId());
        serial = serialRepo.save(serial);

        OrderLineItemSerialEntity bridge = new OrderLineItemSerialEntity();
        bridge.setOrderLineItemId(li.getId());
        bridge.setSerialId(serial.getId());
        bridge.setCreatedAt(now);
        olisRepo.save(bridge);

        // quantity_on_hand for serial-tracked variants is managed by the serial DB trigger,
        // so compare against the value just before restore (not the fixture value).
        int qohBeforeRestore = variantRepo.findById(variant.getId()).orElseThrow().getQuantityOnHand();

        orderStockRestoreService.restoreForRefund(order.getId());

        assertThat(variantRepo.findById(variant.getId()).orElseThrow().getQuantityOnHand())
                .as("serial-tracked line must be skipped by non-serial restore — qoh unchanged")
                .isEqualTo(qohBeforeRestore);
        assertThat(stockMovementRepo.existsByReferenceTypeAndReferenceId("ORDER_REFUND", order.getId()))
                .as("no non-serial IN movement should be written for a serial-tracked line")
                .isFalse();
    }

    // ── Fixtures ────────────────────────────────────────────────────────────────

    private static String uniq() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private ProductEntity saveWpProduct(boolean manageStock, Integer stockQuantity, boolean trackSerials) {
        return saveProduct("wp-prod-" + uniq(), manageStock, stockQuantity, trackSerials);
    }

    private ProductEntity saveProduct(String id, boolean manageStock, Integer stockQuantity, boolean trackSerials) {
        CategoryEntity category = saveCategory();
        ProductEntity p = new ProductEntity();
        p.setId(id);
        p.setSlug("slug-" + uniq());
        p.setName("BUG2 Product " + id);
        p.setCategory(category);
        p.setRetailPrice(new BigDecimal("1000000"));
        p.setCurrency("VND");
        p.setStockState(ProductStockState.IN_STOCK);
        p.setPublishStatus(PublishStatus.PUBLISHED);
        p.setManageStock(manageStock);
        p.setStockQuantity(stockQuantity);
        p.setTrackSerials(trackSerials);
        Instant now = Instant.now();
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        return productRepo.save(p);
    }

    private CategoryEntity saveCategory() {
        CategoryEntity c = new CategoryEntity();
        c.setId("cat-" + uniq());
        c.setSlug("cat-slug-" + uniq());
        c.setName("BUG2 Category");
        c.setVisible(true);
        Instant now = Instant.now();
        c.setCreatedAt(now);
        c.setUpdatedAt(now);
        return categoryRepo.save(c);
    }

    private ProductVariantEntity saveWpVariant(ProductEntity product, int quantityOnHand, boolean trackSerials) {
        return variantRepo.save(newVariant(product, "wp-var-" + uniq(), quantityOnHand, trackSerials));
    }

    private ProductVariantEntity newVariant(ProductEntity product, String id, int quantityOnHand, boolean trackSerials) {
        ProductVariantEntity v = new ProductVariantEntity();
        v.setId(id);
        v.setProduct(product);
        v.setName("Variant " + id);
        v.setStockState(ProductStockState.IN_STOCK);
        v.setQuantityOnHand(quantityOnHand);
        v.setTrackSerials(trackSerials);
        v.setAvailable(true);
        v.setSortOrder(0);
        return v;
    }

    private OrderEntity saveOrder(String status, String paymentStatus) {
        OrderEntity o = new OrderEntity();
        o.setOrderNumber("BUG2-" + uniq());
        o.setStatus(status);
        o.setPaymentStatus(paymentStatus);
        o.setTotalAmount(new BigDecimal("1000000"));
        o.setPaidAmount(new BigDecimal("1000000"));
        Instant now = Instant.now();
        o.setPlacedAt(now);
        o.setCreatedAt(now);
        o.setUpdatedAt(now);
        return orderRepo.save(o);
    }

    /** Builds a line as the FIXED sell path now writes it for wp-* variants: string PKs set, UUIDs null. */
    private OrderLineItemEntity saveWpVariantLine(OrderEntity order, String productPk, String variantPk, int qty) {
        OrderLineItemEntity li = newLine(order, qty);
        li.setProductPk(productPk);
        li.setProductVariantPk(variantPk); // UUID columns left null — the migrated shape
        return lineItemRepo.save(li);
    }

    private OrderLineItemEntity newLine(OrderEntity order, int qty) {
        OrderLineItemEntity li = new OrderLineItemEntity();
        li.setOrder(order);
        li.setProductName("BUG2 Line");
        li.setQuantity(qty);
        li.setUnitPrice(new BigDecimal("1000000"));
        li.setLineSubtotal(new BigDecimal("1000000"));
        li.setLineDiscount(BigDecimal.ZERO);
        li.setLineTax(BigDecimal.ZERO);
        li.setLineTotal(new BigDecimal("1000000"));
        Instant now = Instant.now();
        li.setCreatedAt(now);
        li.setUpdatedAt(now);
        return li;
    }

    private ReturnEntity saveReturn(UUID orderId, String status) {
        ReturnEntity r = new ReturnEntity();
        r.setReturnNumber("RMA-" + uniq());
        r.setOrderId(orderId);
        r.setStatus(status);
        r.setReason("DEFECTIVE");
        r.setRefundAmount(BigDecimal.ZERO);
        Instant now = Instant.now();
        r.setCreatedAt(now);
        r.setUpdatedAt(now);
        return returnRepo.save(r);
    }

    private ReturnItemEntity saveReturnItem(UUID returnId, UUID lineItemId, int qty, String inspectionResult) {
        ReturnItemEntity ri = new ReturnItemEntity();
        ri.setReturnId(returnId);
        ri.setOrderLineItemId(lineItemId);
        ri.setProductName("BUG2 Line");
        ri.setQuantity(qty);
        ri.setUnitPrice(new BigDecimal("1000000"));
        ri.setInspectionResult(inspectionResult);
        ri.setCreatedAt(Instant.now());
        return returnItemRepo.save(ri);
    }
}
