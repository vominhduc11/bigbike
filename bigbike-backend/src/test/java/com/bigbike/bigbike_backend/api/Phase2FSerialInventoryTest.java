package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.domain.catalog.ProductSerialStatus;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.OrderLineItemSerialEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSerialEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.OrderLineItemSerialJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductSerialJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReturnItemSerialJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.returns.ReturnItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import com.bigbike.bigbike_backend.service.inventory.SerialLifecycleService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Integration tests for Phase 14 — Serial-Only Inventory lifecycle.
 *
 * Uses the H2 in-memory database (create-drop mode, no Flyway).
 * Tests 1–2, 13–15 exercise admin HTTP endpoints via MockMvc.
 * Tests 3–12 call SerialLifecycleService directly to test transactions and DB constraints.
 *
 * Note on concurrent test (T5): H2 2.x supports FOR UPDATE SKIP LOCKED.
 * The test verifies application-level isolation. For PostgreSQL-specific MVCC guarantees
 * run the tc profile (Testcontainers).
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class Phase2FSerialInventoryTest {

    private static final String ADMIN_EMAIL = "2f-admin-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS = "Admin@2F3456789";

    @Autowired WebApplicationContext wac;
    @Autowired ProductJpaRepository productRepo;
    @Autowired ProductVariantJpaRepository variantRepo;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired ProductSerialJpaRepository serialRepo;
    @Autowired OrderLineItemSerialJpaRepository olisRepo;
    @Autowired ReturnItemSerialJpaRepository risRepo;
    @Autowired ReturnItemJpaRepository returnItemRepo;
    @Autowired OrderJpaRepository orderRepo;
    @Autowired OrderLineItemJpaRepository lineItemRepo;
    @Autowired SiteSettingJpaRepository settingRepo;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired PasswordService passwordService;
    @Autowired SerialLifecycleService lifecycleService;

    MockMvc mvc;
    String adminToken;

    @BeforeEach
    void setup() throws Exception {
        mvc = MockMvcBuilders.webAppContextSetup(wac)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureAdminUser();
        adminToken = loginAdmin();
        // Reset gate to false before each test so tests are isolated
        settingRepo.findBySettingKey("serial_inventory_only").ifPresent(s -> {
            s.setSettingValue("false");
            settingRepo.save(s);
        });
    }

    // ── T1: Add serial to variant → count = 3, all IN_STOCK ─────────────────

    @Test
    void t01_addSerial_toVariant_createsThreeInStockSerials() throws Exception {
        Fixture f = makeProductVariant("t01");
        String ch1 = "T01-" + uid(), ch2 = "T01-" + uid(), ch3 = "T01-" + uid();

        mvc.perform(post("/api/v1/admin/inventory/variants/" + f.variantId() + "/serials")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"serials":[{"serialNumber":"%s"},{"serialNumber":"%s"},{"serialNumber":"%s"}],"note":"T01"}
                                """.formatted(ch1, ch2, ch3)))
                .andExpect(status().isOk());

        assertThat(serialRepo.countByVariant_IdAndStatus(f.variantId(), ProductSerialStatus.IN_STOCK))
                .isEqualTo(3);
    }

    // ── T2: Add serial to product (no variant) ────────────────────────────────

    @Test
    void t02_addSerial_toProductNoVariant_createsInStockSerials() throws Exception {
        Fixture f = makeProductOnly("t02");
        String ch1 = "T02-" + uid(), ch2 = "T02-" + uid();

        mvc.perform(post("/api/v1/admin/inventory/products/" + f.productId() + "/serials")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"serials":[{"serialNumber":"%s"},{"serialNumber":"%s"}],"note":"T02"}
                                """.formatted(ch1, ch2)))
                .andExpect(status().isOk());

        assertThat(serialRepo.countByProduct_IdAndVariantIsNullAndStatus(f.productId(), ProductSerialStatus.IN_STOCK))
                .isEqualTo(2);
    }

    // ── T3: Checkout reserve serial ───────────────────────────────────────────

    @Test
    void t03_reserve_serial_forOrderLine_transitionsToReserved() {
        Fixture f = makeProductVariant("t03");
        makeSerial(f, ProductSerialStatus.IN_STOCK, "T03-A-" + uid());
        makeSerial(f, ProductSerialStatus.IN_STOCK, "T03-B-" + uid());

        OrderEntity order = makeOrder("PENDING_PAYMENT");
        OrderLineItemEntity li = makeLineItem(order, f.productId(), f.variantId());

        lifecycleService.reserveForOrderLine(li, f.productId(), f.variantId(), 1,
                Instant.now().plusSeconds(900));

        assertThat(serialRepo.countByVariant_IdAndStatus(f.variantId(), ProductSerialStatus.RESERVED)).isEqualTo(1);
        assertThat(serialRepo.countByVariant_IdAndStatus(f.variantId(), ProductSerialStatus.IN_STOCK)).isEqualTo(1);
        assertThat(olisRepo.findByOrderLineItemId(li.getId())).hasSize(1);
    }

    // ── T4: No oversell ───────────────────────────────────────────────────────

    @Test
    void t04_reserve_withInsufficientSerials_throwsConflict_serialUnchanged() {
        Fixture f = makeProductVariant("t04");
        ProductSerialEntity s = makeSerial(f, ProductSerialStatus.IN_STOCK, "T04-" + uid());

        OrderEntity order = makeOrder("PENDING_PAYMENT");
        OrderLineItemEntity li = makeLineItem(order, f.productId(), f.variantId());

        assertThatThrownBy(() ->
                lifecycleService.reserveForOrderLine(li, f.productId(), f.variantId(), 2,
                        Instant.now().plusSeconds(900))
        ).isInstanceOf(ConflictException.class);

        assertThat(serialRepo.findById(s.getId()).orElseThrow().getStatus())
                .isEqualTo(ProductSerialStatus.IN_STOCK);
        assertThat(olisRepo.findByOrderLineItemId(li.getId())).isEmpty();
    }

    // ── T5: Concurrent checkout — only one reservation succeeds ──────────────

    @Test
    void t05_concurrentCheckout_withOneSerial_onlyOneReservationSucceeds() throws Exception {
        Fixture f = makeProductVariant("t05");
        makeSerial(f, ProductSerialStatus.IN_STOCK, "T05-" + uid());

        OrderEntity o1 = makeOrder("PENDING_PAYMENT");
        OrderLineItemEntity li1 = makeLineItem(o1, f.productId(), f.variantId());
        OrderEntity o2 = makeOrder("PENDING_PAYMENT");
        OrderLineItemEntity li2 = makeLineItem(o2, f.productId(), f.variantId());

        ExecutorService pool = Executors.newFixedThreadPool(2);
        AtomicInteger successes = new AtomicInteger(0);
        AtomicInteger failures = new AtomicInteger(0);

        CompletableFuture<Void> f1 = CompletableFuture.runAsync(() -> {
            try {
                lifecycleService.reserveForOrderLine(li1, f.productId(), f.variantId(), 1,
                        Instant.now().plusSeconds(900));
                successes.incrementAndGet();
            } catch (ConflictException e) {
                failures.incrementAndGet();
            }
        }, pool);

        CompletableFuture<Void> f2 = CompletableFuture.runAsync(() -> {
            try {
                lifecycleService.reserveForOrderLine(li2, f.productId(), f.variantId(), 1,
                        Instant.now().plusSeconds(900));
                successes.incrementAndGet();
            } catch (ConflictException e) {
                failures.incrementAndGet();
            }
        }, pool);

        CompletableFuture.allOf(f1, f2).join();
        pool.shutdown();

        assertThat(successes.get()).isEqualTo(1);
        assertThat(failures.get()).isEqualTo(1);
        assertThat(serialRepo.countByVariant_IdAndStatus(f.variantId(), ProductSerialStatus.RESERVED)).isEqualTo(1);
    }

    // ── T6: Order completed → serial SOLD, soldAt non-null ───────────────────

    @Test
    void t06_markSold_forCompletedOrder_serialTransitionsToSold() {
        Fixture f = makeProductVariant("t06");
        ProductSerialEntity serial = makeSerial(f, ProductSerialStatus.IN_STOCK, "T06-" + uid());

        OrderEntity order = makeOrder("PENDING_PAYMENT");
        OrderLineItemEntity li = makeLineItem(order, f.productId(), f.variantId());
        lifecycleService.reserveForOrderLine(li, f.productId(), f.variantId(), 1,
                Instant.now().plusSeconds(900));

        lifecycleService.markSoldForOrder(order.getId());

        ProductSerialEntity updated = serialRepo.findById(serial.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(ProductSerialStatus.SOLD);
        assertThat(updated.getSoldAt()).isNotNull();
    }

    // ── T7: Order cancelled → serial IN_STOCK, reservedUntil null ────────────

    @Test
    void t07_releaseReservation_forCancelledOrder_serialReturnsToInStock() {
        Fixture f = makeProductVariant("t07");
        ProductSerialEntity serial = makeSerial(f, ProductSerialStatus.IN_STOCK, "T07-" + uid());

        OrderEntity order = makeOrder("PENDING_PAYMENT");
        OrderLineItemEntity li = makeLineItem(order, f.productId(), f.variantId());
        lifecycleService.reserveForOrderLine(li, f.productId(), f.variantId(), 1,
                Instant.now().plusSeconds(900));

        assertThat(serialRepo.findById(serial.getId()).orElseThrow().getStatus())
                .isEqualTo(ProductSerialStatus.RESERVED);

        lifecycleService.releaseReservationForOrder(order.getId(), "ORDER_CANCELLED");

        ProductSerialEntity updated = serialRepo.findById(serial.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(ProductSerialStatus.IN_STOCK);
        assertThat(updated.getReservedUntil()).isNull();
    }

    // ── T8: POS — reserve then immediately markSold ────────────────────────────

    @Test
    void t08_posFlow_reserveAndMarkSold_serialEndsSold() {
        Fixture f = makeProductVariant("t08");
        ProductSerialEntity serial = makeSerial(f, ProductSerialStatus.IN_STOCK, "T08-" + uid());

        OrderEntity order = makeOrder("COMPLETED");
        OrderLineItemEntity li = makeLineItem(order, f.productId(), f.variantId());

        lifecycleService.reserveForOrderLine(li, f.productId(), f.variantId(), 1,
                Instant.now().plusSeconds(15));
        lifecycleService.markSoldForOrder(order.getId());

        ProductSerialEntity updated = serialRepo.findById(serial.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(ProductSerialStatus.SOLD);
        assertThat(updated.getSoldAt()).isNotNull();
    }

    // ── T9: Return received → serial RETURNED ────────────────────────────────

    @Test
    void t09_receiveReturn_forSoldSerial_transitionsToReturned() {
        Fixture f = makeProductVariant("t09");
        ProductSerialEntity serial = makeSerial(f, ProductSerialStatus.SOLD, "T09-" + uid());

        // Simulate sold bridge record
        UUID lineItemId = UUID.randomUUID();
        OrderLineItemSerialEntity bridge = new OrderLineItemSerialEntity();
        bridge.setOrderLineItemId(lineItemId);
        bridge.setSerialId(serial.getId());
        bridge.setCreatedAt(Instant.now());
        olisRepo.save(bridge);

        // Return item referencing same line item
        UUID returnId = UUID.randomUUID();
        ReturnItemEntity ri = new ReturnItemEntity();
        ri.setReturnId(returnId);
        ri.setOrderLineItemId(lineItemId);
        ri.setProductName("Test Product T09");
        ri.setQuantity(1);
        ri.setCreatedAt(Instant.now());
        returnItemRepo.save(ri);

        lifecycleService.receiveReturnForReturn(returnId);

        assertThat(serialRepo.findById(serial.getId()).orElseThrow().getStatus())
                .isEqualTo(ProductSerialStatus.RETURNED);
        assertThat(risRepo.findByReturnItemId(ri.getId())).isNotEmpty();
    }

    // ── T10: Inspection pass → serial IN_STOCK ─────────────────────────────

    @Test
    void t10_markInspection_passResult_serialBackToInStock() {
        Fixture f = makeProductVariant("t10");
        ProductSerialEntity serial = makeSerial(f, ProductSerialStatus.INSPECTION, "T10-" + uid());

        lifecycleService.markInspectionResult(serial.getId(), ProductSerialStatus.IN_STOCK, null);

        assertThat(serialRepo.findById(serial.getId()).orElseThrow().getStatus())
                .isEqualTo(ProductSerialStatus.IN_STOCK);
    }

    // ── T11a: Inspection DAMAGED without note → ConflictException ─────────────

    @Test
    void t11a_markInspection_damagedWithoutNote_throwsConflict() {
        Fixture f = makeProductVariant("t11a");
        ProductSerialEntity serial = makeSerial(f, ProductSerialStatus.INSPECTION, "T11A-" + uid());

        assertThatThrownBy(() ->
                lifecycleService.markInspectionResult(serial.getId(), ProductSerialStatus.DAMAGED, null)
        ).isInstanceOf(ConflictException.class);

        assertThat(serialRepo.findById(serial.getId()).orElseThrow().getStatus())
                .isEqualTo(ProductSerialStatus.INSPECTION);
    }

    // ── T11b: Inspection DAMAGED with note → DAMAGED, note saved ─────────────

    @Test
    void t11b_markInspection_damagedWithNote_serialIsDamaged() {
        Fixture f = makeProductVariant("t11b");
        ProductSerialEntity serial = makeSerial(f, ProductSerialStatus.INSPECTION, "T11B-" + uid());

        lifecycleService.markInspectionResult(serial.getId(), ProductSerialStatus.DAMAGED, "khung bị cong");

        ProductSerialEntity updated = serialRepo.findById(serial.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(ProductSerialStatus.DAMAGED);
        assertThat(updated.getNote()).isEqualTo("khung bị cong");
    }

    // ── T12: Expired reservation cleanup ──────────────────────────────────────

    @Test
    void t12_releaseExpiredReservations_expiredSerial_returnsToInStock() {
        Fixture f = makeProductVariant("t12");
        ProductSerialEntity serial = makeSerial(f, ProductSerialStatus.RESERVED, "T12-" + uid());
        serial.setReservedUntil(Instant.now().minusSeconds(120));
        serialRepo.save(serial);

        List<String> released = lifecycleService.releaseExpiredReservations();

        assertThat(released).hasSizeGreaterThanOrEqualTo(1);
        ProductSerialEntity updated = serialRepo.findById(serial.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(ProductSerialStatus.IN_STOCK);
        assertThat(updated.getReservedUntil()).isNull();
    }

    // ── T13: Manual quantity adjust blocked when serial_inventory_only=true ───

    @Test
    void t13_adjustStock_whenSerialInventoryOnlyEnabled_returns400WithCode() throws Exception {
        Fixture f = makeProductVariant("t13");

        SiteSettingEntity gate = settingRepo.findBySettingKey("serial_inventory_only")
                .orElseGet(SiteSettingEntity::new);
        gate.setSettingKey("serial_inventory_only");
        gate.setSettingValue("true");
        settingRepo.save(gate);

        mvc.perform(post("/api/v1/admin/inventory/variants/" + f.variantId() + "/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"quantityDelta":5,"movementType":"IN","note":"should be blocked"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].code").value("SERIAL_INVENTORY_ONLY"));
    }

    // ── T14: Import serial without variantId for product with variants ─────────

    @Test
    void t14_importSerial_missingVariantId_forProductWithVariants_rejectsRow() throws Exception {
        Fixture f = makeProductVariant("t14");

        String resp = mvc.perform(post("/api/v1/admin/inventory/serials/import")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "rows": [{"productId":"%s","serialNumber":"T14-%s"}],
                                  "partialMode": true
                                }
                                """.formatted(f.productId(), uid())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(resp).contains("REQUIRED_FOR_VARIANT_PRODUCT");
    }

    // ── T15: Duplicate chassis number rejected ────────────────────────────────

    @Test
    void t15_importSerial_duplicateChassis_rejectsSecondImport() throws Exception {
        Fixture f = makeProductVariant("t15");
        String chassis = "T15-DUP-" + uid();

        // First import — should succeed
        mvc.perform(post("/api/v1/admin/inventory/serials/import")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"rows":[{"productId":"%s","variantId":"%s","serialNumber":"%s"}],"partialMode":false}
                                """.formatted(f.productId(), f.variantId(), chassis)))
                .andExpect(status().isOk());

        // Second import with same serial → reports DUPLICATE_IN_DB
        String resp = mvc.perform(post("/api/v1/admin/inventory/serials/import")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"rows":[{"productId":"%s","variantId":"%s","serialNumber":"%s"}],"partialMode":true}
                                """.formatted(f.productId(), f.variantId(), chassis)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(resp).contains("DUPLICATE_IN_DB");
    }

    // ── Fixture helpers ───────────────────────────────────────────────────────

    record Fixture(String productId, String variantId, ProductEntity product, ProductVariantEntity variant) {}

    private Fixture makeProductVariant(String tag) {
        Instant now = Instant.now();
        CategoryEntity cat = new CategoryEntity();
        cat.setId("cat-" + tag + "-" + uid());
        cat.setSlug("cat-" + tag + "-" + uid());
        cat.setName("Cat " + tag);
        cat.setVisible(true);
        cat.setCreatedAt(now);
        cat.setUpdatedAt(now);
        categoryRepo.save(cat);

        String productId = UUID.randomUUID().toString();
        ProductEntity product = new ProductEntity();
        product.setId(productId);
        product.setSlug("p-" + productId.substring(0, 8));
        product.setName("Product " + tag);
        product.setRetailPrice(BigDecimal.valueOf(500_000));
        product.setCurrency("VND");
        product.setPublishStatus(PublishStatus.PUBLISHED);
        product.setStockState(ProductStockState.IN_STOCK);
        product.setCreatedAt(now);
        product.setUpdatedAt(now);
        product.setCategory(cat);
        productRepo.save(product);

        String variantId = UUID.randomUUID().toString();
        ProductVariantEntity variant = new ProductVariantEntity();
        variant.setId(variantId);
        variant.setProduct(product);
        variant.setName("Default");
        variant.setSku("SKU-" + tag + "-" + uid());
        variant.setRetailPrice(BigDecimal.valueOf(500_000));
        variant.setCurrency("VND");
        variant.setStockState(ProductStockState.IN_STOCK);
        variant.setQuantityOnHand(0);
        variant.setAvailable(true);
        variant.setSortOrder(0);
        variant.setTrackSerials(true);
        variantRepo.save(variant);

        return new Fixture(productId, variantId, product, variant);
    }

    private Fixture makeProductOnly(String tag) {
        Instant now = Instant.now();
        CategoryEntity cat = new CategoryEntity();
        cat.setId("cat-" + tag + "-" + uid());
        cat.setSlug("cat-" + tag + "-" + uid());
        cat.setName("Cat " + tag);
        cat.setVisible(true);
        cat.setCreatedAt(now);
        cat.setUpdatedAt(now);
        categoryRepo.save(cat);

        String productId = UUID.randomUUID().toString();
        ProductEntity product = new ProductEntity();
        product.setId(productId);
        product.setSlug("p-" + productId.substring(0, 8));
        product.setName("Product " + tag);
        product.setRetailPrice(BigDecimal.valueOf(500_000));
        product.setCurrency("VND");
        product.setPublishStatus(PublishStatus.PUBLISHED);
        product.setStockState(ProductStockState.IN_STOCK);
        product.setTrackSerials(true);
        product.setCreatedAt(now);
        product.setUpdatedAt(now);
        product.setCategory(cat);
        productRepo.save(product);

        return new Fixture(productId, null, product, null);
    }

    private ProductSerialEntity makeSerial(Fixture f, ProductSerialStatus status, String serialNumber) {
        Instant now = Instant.now();
        ProductSerialEntity serial = new ProductSerialEntity();
        serial.setProduct(f.product());
        serial.setVariant(f.variant());
        serial.setSerialNumber(serialNumber);
        serial.setStatus(status);
        serial.setReceivedAt(now);
        serial.setCreatedAt(now);
        serial.setUpdatedAt(now);
        return serialRepo.save(serial);
    }

    private OrderEntity makeOrder(String status) {
        Instant now = Instant.now();
        OrderEntity order = new OrderEntity();
        order.setOrderNumber("TEST-" + uid());
        order.setStatus(status);
        order.setPaymentStatus("PENDING");
        order.setCurrency("VND");
        order.setCreatedAt(now);
        order.setUpdatedAt(now);
        return orderRepo.save(order);
    }

    private OrderLineItemEntity makeLineItem(OrderEntity order, String productId, String variantId) {
        Instant now = Instant.now();
        OrderLineItemEntity li = new OrderLineItemEntity();
        li.setOrder(order);
        if (productId != null) li.setProductId(UUID.fromString(productId));
        if (variantId != null) li.setProductVariantId(UUID.fromString(variantId));
        li.setProductName("Test Product");
        li.setQuantity(1);
        li.setUnitPrice(BigDecimal.ZERO);
        li.setLineSubtotal(BigDecimal.ZERO);
        li.setLineDiscount(BigDecimal.ZERO);
        li.setLineTax(BigDecimal.ZERO);
        li.setLineTotal(BigDecimal.ZERO);
        li.setCreatedAt(now);
        li.setUpdatedAt(now);
        return lineItemRepo.save(li);
    }

    private void ensureAdminUser() {
        adminUserRepo.findByEmail(ADMIN_EMAIL).orElseGet(() -> {
            Instant now = Instant.now();
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(ADMIN_EMAIL);
            admin.setPasswordHash(passwordService.hash(ADMIN_PASS));
            admin.setDisplayName("Phase2F Admin");
            admin.setRole("ADMIN");
            admin.setStatus("ACTIVE");
            admin.setCreatedAt(now);
            admin.setUpdatedAt(now);
            return adminUserRepo.save(admin);
        });
    }

    private String loginAdmin() throws Exception {
        MvcResult r = mvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + ADMIN_EMAIL + "\",\"password\":\"" + ADMIN_PASS + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String body = r.getResponse().getContentAsString();
        String marker = "\"accessToken\":\"";
        int start = body.indexOf(marker) + marker.length();
        return body.substring(start, body.indexOf("\"", start));
    }

    private static String uid() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }
}
