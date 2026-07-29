package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bigbike.bigbike_backend.domain.commerce.PaymentRecordStatus;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Verifies the canonical payment snapshot status schema produced by V353. */
@SpringBootTest
@ActiveProfiles("tc")
@Testcontainers(disabledWithoutDocker = true)
class PaymentRecordStatusMigrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private OrderJpaRepository orderRepository;

    @Autowired
    private PaymentJpaRepository paymentRepository;

    @Test
    void v353AcceptsCanonicalEnumAndRejectsLegacyVocabulary() {
        OrderEntity order = new OrderEntity();
        order.setOrderNumber("PAY-MIG-" + UUID.randomUUID());
        order.setOrderKey("pay-key-" + UUID.randomUUID());
        order.setStatus("COMPLETED");
        order.setPaymentMethod("BACS");
        order.setPlacedAt(Instant.now());
        order.setCompletedAt(Instant.now());
        order.setCreatedAt(Instant.now());
        order.setUpdatedAt(Instant.now());
        order = orderRepository.saveAndFlush(order);

        PaymentEntity canonical = new PaymentEntity();
        canonical.setOrder(order);
        canonical.setPaymentMethod("BACS");
        canonical.setStatus(PaymentRecordStatus.SUCCEEDED);
        canonical.setAmount(BigDecimal.valueOf(500_000));
        canonical.setCurrency("VND");
        canonical.setCreatedAt(Instant.now());
        canonical.setUpdatedAt(Instant.now());
        paymentRepository.saveAndFlush(canonical);

        assertThat(paymentRepository.findByOrderId(order.getId()))
                .extracting(PaymentEntity::getStatus)
                .containsExactly(PaymentRecordStatus.SUCCEEDED);

        UUID orderId = order.getId();
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO payments (
                    id, order_id, payment_method, status, amount, currency, created_at, updated_at
                ) VALUES (?, ?, 'BACS', 'PAID', 0, 'VND', now(), now())
                """, UUID.randomUUID(), orderId))
                .isInstanceOf(DataAccessException.class);

        String constraint = jdbc.queryForObject("""
                SELECT pg_get_constraintdef(oid)
                FROM pg_constraint
                WHERE conname = 'ck_payments_status'
                """, String.class);
        assertThat(constraint)
                .contains("PENDING", "SUCCEEDED", "FAILED", "CANCELLED")
                .doesNotContain("'PAID'", "'UNPAID'", "'REFUNDED'");
    }

    @Test
    void v353ConvertsEveryApprovedLegacyVocabulary() throws Exception {
        OrderEntity order = new OrderEntity();
        order.setOrderNumber("PAY-LEGACY-" + UUID.randomUUID());
        order.setOrderKey("pay-legacy-key-" + UUID.randomUUID());
        order.setStatus("COMPLETED");
        order.setPaymentMethod("BACS");
        order.setPlacedAt(Instant.now());
        order.setCompletedAt(Instant.now());
        order.setCreatedAt(Instant.now());
        order.setUpdatedAt(Instant.now());
        order = orderRepository.saveAndFlush(order);

        jdbc.execute("ALTER TABLE payments DROP CONSTRAINT IF EXISTS ck_payments_status");

        UUID paidId = insertLegacyPayment(order.getId(), "PAID");
        UUID unpaidId = insertLegacyPayment(order.getId(), "UNPAID");
        UUID refundedId = insertLegacyPayment(order.getId(), "REFUNDED");

        String migrationSql = new ClassPathResource(
                "db/migration/V353__normalize_payment_record_status.sql"
        ).getContentAsString(StandardCharsets.UTF_8);
        jdbc.execute(migrationSql);

        assertThat(paymentStatus(paidId)).isEqualTo("SUCCEEDED");
        assertThat(paymentStatus(unpaidId)).isEqualTo("PENDING");
        assertThat(paymentStatus(refundedId)).isEqualTo("CANCELLED");
    }

    private UUID insertLegacyPayment(UUID orderId, String status) {
        UUID paymentId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO payments (
                    id, order_id, payment_method, status, amount, currency, created_at, updated_at
                ) VALUES (?, ?, 'BACS', ?, 0, 'VND', now(), now())
                """, paymentId, orderId, status);
        return paymentId;
    }

    private String paymentStatus(UUID paymentId) {
        return jdbc.queryForObject(
                "SELECT status FROM payments WHERE id = ?",
                String.class,
                paymentId
        );
    }
}
