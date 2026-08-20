package com.bigbike.bigbike_backend.service.cart;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartJpaRepository;
import com.bigbike.bigbike_backend.service.audit.AuditLogRetentionCleanupService;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Exercises the PostgreSQL batch SQL and the V1045–V1047 schema on a real database. */
@SpringBootTest
@ActiveProfiles("tc")
@Testcontainers(disabledWithoutDocker = true)
class CartRetentionPostgresIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired CartJpaRepository cartRepo;
    @Autowired CartItemJpaRepository cartItemRepo;
    @Autowired CartService cartService;
    @Autowired CartRetentionCleanupService cartRetentionCleanupService;
    @Autowired AuditLogJpaRepository auditLogRepo;
    @Autowired AuditLogRetentionCleanupService auditLogRetentionCleanupService;
    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void clean() {
        cartItemRepo.deleteAll();
        cartRepo.deleteAll();
        auditLogRepo.deleteAll();
    }

    @Test
    void guestInteractionExtendsExpiryByThirtyDays() {
        Instant before = Instant.now();
        CartEntity cart = cartService.getOrCreateGuestCart("retention-test-guest");
        Instant after = Instant.now();

        assertThat(cart.getExpiresAt())
                .isBetween(before.plus(30, ChronoUnit.DAYS), after.plus(30, ChronoUnit.DAYS));
    }

    @Test
    void retentionDeletesOnlyExpiredActiveAndMergedCartsAndPreservesConvertedCartItems() {
        CartEntity active = cart("ACTIVE", Instant.now().minus(1, ChronoUnit.DAYS));
        CartEntity merged = cart("MERGED", Instant.now().minus(1, ChronoUnit.DAYS));
        CartEntity fresh = cart("ACTIVE", Instant.now().plus(1, ChronoUnit.DAYS));
        CartEntity converted = cart("CONVERTED", Instant.now().minus(30, ChronoUnit.DAYS));
        CartItemEntity convertedItem = cartItem(converted);
        cartItemRepo.save(convertedItem);

        cartRetentionCleanupService.purgeExpiredCarts();

        assertThat(cartRepo.findById(active.getId())).isEmpty();
        assertThat(cartRepo.findById(merged.getId())).isEmpty();
        assertThat(cartRepo.findById(fresh.getId())).isPresent();
        assertThat(cartRepo.findById(converted.getId())).isPresent();
        assertThat(cartItemRepo.findById(convertedItem.getId())).isPresent();
    }

    @Test
    void retentionContinuesAcrossFiveHundredCartBatches() {
        Instant expired = Instant.now().minus(1, ChronoUnit.DAYS);
        List<CartEntity> carts = java.util.stream.IntStream.range(0, 501)
                .mapToObj(index -> newCart("ACTIVE", expired))
                .toList();
        cartRepo.saveAll(carts);

        cartRetentionCleanupService.purgeExpiredCarts();

        assertThat(cartRepo.findByExpiresAtBefore(Instant.now(), org.springframework.data.domain.Pageable.unpaged()))
                .isEmpty();
    }

    @Test
    void auditRetentionDeletesOnlyRowsOlderThanTwelveCalendarMonths() {
        java.time.ZoneId vietnam = java.time.ZoneId.of("Asia/Ho_Chi_Minh");
        AuditLogEntity old = audit(java.time.ZonedDateTime.now(vietnam).minusMonths(13).toInstant());
        AuditLogEntity current = audit(java.time.ZonedDateTime.now(vietnam).minusMonths(11).toInstant());
        auditLogRepo.saveAll(List.of(old, current));

        auditLogRetentionCleanupService.purgeExpiredAuditLogs();

        assertThat(auditLogRepo.findById(old.getId())).isEmpty();
        assertThat(auditLogRepo.findById(current.getId())).isPresent();
    }

    @Test
    void migrationsCreateBackupLedgerRequireVariantLinksAndInstallStatementExtension() {
        assertThat(jdbcTemplate.queryForObject(
                "select to_regclass('maintenance_cart_purge_runs') is not null", Boolean.class)).isTrue();
        assertThat(jdbcTemplate.queryForObject("""
                select is_nullable = 'NO'
                from information_schema.columns
                where table_schema = 'public'
                  and table_name = 'product_variant_options'
                  and column_name = 'attribute_value_id'
                """, Boolean.class)).isTrue();
        assertThat(jdbcTemplate.queryForObject(
                "select exists(select 1 from pg_extension where extname = 'pg_stat_statements')", Boolean.class)).isTrue();
    }

    @Test
    void restoreReturnsOnlyTheCartsAndItemsOfTheRequestedCompletedRun() {
        CartEntity original = cart("ACTIVE", Instant.now().minus(1, ChronoUnit.DAYS));
        CartItemEntity originalItem = cartItem(original);
        cartItemRepo.save(originalItem);
        UUID runId = UUID.randomUUID();

        jdbcTemplate.update("""
                insert into maintenance_cart_purge_runs (id, cutoff_at, status)
                values (?, now(), 'COMPLETED')
                """, runId);
        jdbcTemplate.update("""
                insert into maintenance_cart_purge_backup_carts (
                    run_id, purged_at, id, customer_id, session_id, status, currency, subtotal_amount,
                    discount_amount, shipping_amount, fee_amount, total_amount, expires_at, created_at,
                    updated_at, version
                )
                select ?, now(), id, customer_id, session_id, status, currency, subtotal_amount,
                    discount_amount, shipping_amount, fee_amount, total_amount, expires_at, created_at,
                    updated_at, version
                from carts where id = ?
                """, runId, original.getId());
        jdbcTemplate.update("""
                insert into maintenance_cart_purge_backup_items (
                    run_id, purged_at, id, cart_id, product_id, product_pk, product_variant_id,
                    product_variant_pk, assistant_conversation_id, assistant_interaction_id, sku,
                    product_name, variant_name, product_image_id, product_image_url, product_image_alt,
                    product_image_width, product_image_height, product_image_mime_type, quantity,
                    unit_price, regular_price, sale_price, line_subtotal, line_discount, line_total,
                    metadata, created_at, updated_at
                )
                select ?, now(), id, cart_id, product_id, product_pk, product_variant_id,
                    product_variant_pk, assistant_conversation_id, assistant_interaction_id, sku,
                    product_name, variant_name, product_image_id, product_image_url, product_image_alt,
                    product_image_width, product_image_height, product_image_mime_type, quantity,
                    unit_price, regular_price, sale_price, line_subtotal, line_discount, line_total,
                    metadata, created_at, updated_at
                from cart_items where id = ?
                """, runId, originalItem.getId());
        jdbcTemplate.update("delete from carts where id = ?", original.getId());

        jdbcTemplate.update("""
                insert into carts (
                    id, customer_id, session_id, status, currency, subtotal_amount, discount_amount,
                    shipping_amount, fee_amount, total_amount, expires_at, created_at, updated_at, version
                )
                select id, customer_id, session_id, status, currency, subtotal_amount, discount_amount,
                    shipping_amount, fee_amount, total_amount, expires_at, created_at, updated_at, version
                from maintenance_cart_purge_backup_carts where run_id = ?
                """, runId);
        jdbcTemplate.update("""
                insert into cart_items (
                    id, cart_id, product_id, product_pk, product_variant_id, product_variant_pk,
                    assistant_conversation_id, assistant_interaction_id, sku, product_name, variant_name,
                    product_image_id, product_image_url, product_image_alt, product_image_width,
                    product_image_height, product_image_mime_type, quantity, unit_price, regular_price,
                    sale_price, line_subtotal, line_discount, line_total, metadata, created_at, updated_at
                )
                select id, cart_id, product_id, product_pk, product_variant_id, product_variant_pk,
                    assistant_conversation_id, assistant_interaction_id, sku, product_name, variant_name,
                    product_image_id, product_image_url, product_image_alt, product_image_width,
                    product_image_height, product_image_mime_type, quantity, unit_price, regular_price,
                    sale_price, line_subtotal, line_discount, line_total, metadata, created_at, updated_at
                from maintenance_cart_purge_backup_items where run_id = ?
                """, runId);
        jdbcTemplate.update("""
                update maintenance_cart_purge_runs
                set status = 'RESTORED', completed_at = now()
                where id = ? and status = 'COMPLETED'
                """, runId);

        assertThat(cartRepo.findById(original.getId())).isPresent();
        assertThat(cartItemRepo.findById(originalItem.getId())).isPresent();
        assertThat(jdbcTemplate.queryForObject(
                "select status from maintenance_cart_purge_runs where id = ?", String.class, runId))
                .isEqualTo("RESTORED");
    }

    private CartEntity cart(String status, Instant expiresAt) {
        return cartRepo.save(newCart(status, expiresAt));
    }

    private CartEntity newCart(String status, Instant expiresAt) {
        Instant now = Instant.now();
        CartEntity cart = new CartEntity();
        cart.setStatus(status);
        cart.setCurrency("VND");
        cart.setExpiresAt(expiresAt);
        cart.setCreatedAt(now);
        cart.setUpdatedAt(now);
        return cart;
    }

    private CartItemEntity cartItem(CartEntity cart) {
        Instant now = Instant.now();
        CartItemEntity item = new CartItemEntity();
        item.setCart(cart);
        item.setProductName("Dòng hàng cần được giữ lại");
        item.setQuantity(1);
        item.setUnitPrice(BigDecimal.ONE);
        item.setLineSubtotal(BigDecimal.ONE);
        item.setLineDiscount(BigDecimal.ZERO);
        item.setLineTotal(BigDecimal.ONE);
        item.setCreatedAt(now);
        item.setUpdatedAt(now);
        return item;
    }

    private AuditLogEntity audit(Instant createdAt) {
        AuditLogEntity log = new AuditLogEntity();
        log.setAction("RETENTION_TEST");
        log.setCreatedAt(createdAt);
        return log;
    }
}
