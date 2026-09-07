package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bigbike.bigbike_backend.api.admin.dto.order.UpdateOrderStatusRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.domain.commerce.PaymentRecordStatus;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@ActiveProfiles("tc")
@Testcontainers(disabledWithoutDocker = true)
class BankTransferPostgresIntegrationTest {
    @Container @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired AdminOrderService service;
    @Autowired OrderJpaRepository orders;
    @Autowired PaymentJpaRepository payments;
    @Autowired AuditLogJpaRepository audits;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired JdbcTemplate jdbc;
    private final UUID adminId = UUID.randomUUID();

    @Test
    void concurrentReceiptsWriteExactlyOneAuditAndPreserveOrderStatus() throws Exception {
        OrderEntity order = fixture();
        assertThat(race(() -> confirm(order), () -> confirm(order))).containsExactly("ok", "ok");
        assertThat(orders.findById(order.getId()).orElseThrow().getStatus()).isEqualTo("PROCESSING");
        assertReceiptCount(order, 1);
        assertThat(payments.findByOrderId(order.getId()).get(0).getStatus()).isEqualTo(PaymentRecordStatus.SUCCEEDED);
    }

    @Test
    void completionRacingReceiptNeverCompletesAnUnpaidOrder() throws Exception {
        OrderEntity order = fixture();
        var results = race(() -> confirm(order), () -> status(order, "COMPLETED"));
        assertThat(results.get(0)).isEqualTo("ok");
        assertThat(results.get(1)).isIn("ok", "BANK_TRANSFER_PAYMENT_REQUIRED");
        assertThat(payments.findByOrderId(order.getId()).get(0).getStatus()).isEqualTo(PaymentRecordStatus.SUCCEEDED);
        assertReceiptCount(order, 1);
        assertThat(status(order, "COMPLETED")).isEqualTo("ok");
    }

    @Test
    void cancellationRacingReceiptDoesNotConfirmAfterCancellation() throws Exception {
        OrderEntity order = fixture();
        var results = race(() -> confirm(order), () -> status(order, "CANCELLED"));
        assertThat(results.get(1)).isEqualTo("ok");
        assertThat(results.get(0)).isIn("ok", "BANK_TRANSFER_NOT_APPLICABLE");
        assertThat(orders.findById(order.getId()).orElseThrow().getStatus()).isEqualTo("CANCELLED");
        assertReceiptCount(order, results.get(0).equals("ok") ? 1 : 0);
        assertThat(confirm(order)).isEqualTo("BANK_TRANSFER_NOT_APPLICABLE");
    }

    @Test
    void transactionRollbackAlsoRemovesReceiptAudit() {
        OrderEntity order = fixture();
        var transaction = new TransactionTemplate(transactionManager);
        assertThatThrownBy(() -> transaction.executeWithoutResult(ignored -> {
            service.confirmBankTransfer(order.getId(), adminId, "127.0.0.1", "test");
            throw new IllegalStateException("Simulated commit failure");
        })).isInstanceOf(IllegalStateException.class);
        assertReceiptCount(order, 0);
        assertThat(payments.findByOrderId(order.getId()).get(0).getStatus()).isEqualTo(PaymentRecordStatus.PENDING);
        var unchanged = orders.findById(order.getId()).orElseThrow();
        assertThat(unchanged.getPaidAmount()).isZero();
        assertThat(unchanged.getPaidAt()).isNull();
    }

    @Test
    void historicalOrderCannotBeConfirmedOrCompleted() {
        OrderEntity order = fixture();
        UUID batch = UUID.randomUUID();
        jdbc.update("""
                insert into order_history_batches (id, batch_key, label_vi, label_en, reason_vi, reason_en,
                    criteria_json, expected_total, expected_pending, expected_processing, active, created_at, activated_at)
                values (?, ?, 'Đơn cũ', 'Historical', 'Chỉ xem', 'Read only', '{}'::jsonb, 1, 0, 1, true, now(), now())
                """, batch, "RECEIPT_TEST_" + batch);
        jdbc.update("insert into order_history_batch_orders (batch_id, order_id) values (?, ?)", batch, order.getId());
        assertThat(confirm(order)).isEqualTo("HISTORICAL_ORDER_READ_ONLY");
        assertThat(status(order, "COMPLETED")).isEqualTo("HISTORICAL_ORDER_READ_ONLY");
        assertThat(service.listAllowedTransitions(order.getId())).isEmpty();
        assertThat(service.getOrderDetail(order.getId()).canConfirmBankTransfer()).isFalse();
        assertReceiptCount(order, 0);
        assertThat(payments.findByOrderId(order.getId()).get(0).getStatus()).isEqualTo(PaymentRecordStatus.PENDING);
    }

    private String confirm(OrderEntity order) {
        try { service.confirmBankTransfer(order.getId(), adminId, "127.0.0.1", "test"); return "ok"; }
        catch (ConflictException error) { return error.code(); }
    }

    private String status(OrderEntity order, String status) {
        try {
            service.updateOrderStatus(order.getId(), adminId,
                    new UpdateOrderStatusRequest(status, "Test cancellation"), "127.0.0.1", "test");
            return "ok";
        } catch (ConflictException error) { return error.code(); }
    }

    private List<String> race(Callable<String> first, Callable<String> second) throws Exception {
        var executor = Executors.newFixedThreadPool(2);
        var ready = new CountDownLatch(2);
        try {
            var left = executor.submit(() -> { ready.countDown(); ready.await(10, TimeUnit.SECONDS); return first.call(); });
            var right = executor.submit(() -> { ready.countDown(); ready.await(10, TimeUnit.SECONDS); return second.call(); });
            return List.of(left.get(30, TimeUnit.SECONDS), right.get(30, TimeUnit.SECONDS));
        } finally { executor.shutdownNow(); }
    }

    private void assertReceiptCount(OrderEntity order, int count) {
        assertThat(audits.findByResourceTypeAndResourceId("ORDER", order.getId()).stream()
                .filter(entry -> "ORDER_BANK_TRANSFER_CONFIRMED".equals(entry.getAction())).toList()).hasSize(count);
    }

    private OrderEntity fixture() {
        var order = new OrderEntity();
        order.setOrderNumber("RECEIPT-" + UUID.randomUUID());
        order.setOrderKey(UUID.randomUUID().toString());
        order.setStatus("PROCESSING"); order.setPaymentMethod("BANK_TRANSFER");
        order.setCurrency("VND"); order.setTotalAmount(new BigDecimal("1250000"));
        order.setSubtotalAmount(order.getTotalAmount()); order.setChannel("WEB");
        order.setFulfillmentType("DELIVERY"); order.setCustomerName("Receipt test");
        order.setCreatedAt(Instant.now()); order.setUpdatedAt(Instant.now()); order.setPlacedAt(Instant.now());
        order = orders.saveAndFlush(order);
        var payment = new PaymentEntity();
        payment.setOrder(order); payment.setPaymentMethod("BANK_TRANSFER"); payment.setCurrency("VND");
        payment.setStatus(PaymentRecordStatus.PENDING); payment.setAmount(order.getTotalAmount());
        payment.setCreatedAt(Instant.now()); payment.setUpdatedAt(Instant.now());
        payments.saveAndFlush(payment);
        return order;
    }
}
