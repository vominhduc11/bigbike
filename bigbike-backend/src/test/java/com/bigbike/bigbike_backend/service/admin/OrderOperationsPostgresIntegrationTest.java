package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bigbike.bigbike_backend.api.admin.dto.order.UpdateOrderStatusRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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

@SpringBootTest
@ActiveProfiles("tc")
@Testcontainers(disabledWithoutDocker = true)
class OrderOperationsPostgresIntegrationTest {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired OrderJpaRepository orderRepository;
    @Autowired AdminOrderService adminOrderService;
    @Autowired AdminDashboardService adminDashboardService;
    @Autowired AdminReportService adminReportService;

    @BeforeEach
    void clearOrderOperationsData() {
        jdbcTemplate.update("delete from order_overdue_reminder_orders");
        jdbcTemplate.update("delete from order_overdue_reminder_runs");
        jdbcTemplate.update("delete from order_history_batch_orders");
        jdbcTemplate.update("delete from order_history_batches");
        orderRepository.deleteAll();
    }

    @Test
    void historicalOrdersAreSearchableButExcludedFromOperationsAndRemainReadOnly() {
        Instant now = Instant.now();
        OrderEntity historical = order("PENDING", "100000", now.minusSeconds(5 * 86_400L), 101L);
        OrderEntity overdueOperational = order("PENDING", "200000", now.minusSeconds(5 * 86_400L), null);
        OrderEntity withinWindowOperational = order("PENDING", "300000", now.minusSeconds(86_400L), null);
        orderRepository.saveAndFlush(historical);
        orderRepository.saveAndFlush(overdueOperational);
        orderRepository.saveAndFlush(withinWindowOperational);

        UUID batchId = insertHistoryBatch();
        int firstMark = markHistorical(batchId, historical.getId());
        int secondMark = markHistorical(batchId, historical.getId());

        assertThat(firstMark).isEqualTo(1);
        assertThat(secondMark).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from order_history_batch_orders where batch_id = ?",
                Integer.class,
                batchId)).isEqualTo(1);
        assertThat(orderRepository.findById(historical.getId()).orElseThrow())
                .satisfies(order -> {
                    assertThat(order.getStatus()).isEqualTo("PENDING");
                    assertThat(order.getTotalAmount()).isEqualByComparingTo("100000");
                });

        var operational = adminOrderService.listOrders(
                1, 20, null, null, null, null, "placedAt:desc", "OPERATIONAL", null);
        var history = adminOrderService.listOrders(
                1, 20, null, null, null, null, "placedAt:desc", "HISTORICAL", null);
        var all = adminOrderService.listOrders(
                1, 20, null, null, null, null, "placedAt:desc", "ALL", null);
        var overdue = adminOrderService.listOrders(
                1, 20, null, null, null, null, "placedAt:desc", "OPERATIONAL", "OVERDUE");

        assertThat(operational.items()).extracting(item -> item.id())
                .containsExactlyInAnyOrder(overdueOperational.getId(), withinWindowOperational.getId());
        assertThat(history.items()).singleElement().satisfies(item -> {
            assertThat(item.id()).isEqualTo(historical.getId());
            assertThat(item.orderScope()).isEqualTo("HISTORICAL");
            assertThat(item.historyClassification().batchKey())
                    .isEqualTo("LEGACY_WEB_IMPORT_2026_06_11");
        });
        assertThat(all.items()).hasSize(3);
        assertThat(overdue.items()).extracting(item -> item.id())
                .containsExactly(overdueOperational.getId());

        Instant reminderCutoff = now.minusSeconds(2 * 86_400L);
        assertThat(orderRepository.findUnremindedOverdueOperationalPending(reminderCutoff))
                .extracting(OrderEntity::getId)
                .containsExactly(overdueOperational.getId());

        LocalDate reminderDate = now.atZone(VN_ZONE).toLocalDate();
        jdbcTemplate.update("""
                insert into order_overdue_reminder_runs (
                    run_date, threshold_days, cutoff_at, candidate_count, completed_at, created_at
                ) values (?, 2, ?, 1, ?, ?)
                """, reminderDate, Timestamp.from(reminderCutoff), Timestamp.from(now), Timestamp.from(now));
        jdbcTemplate.update("""
                insert into order_overdue_reminder_orders (order_id, run_date, reminded_at)
                values (?, ?, ?)
                """, overdueOperational.getId(), reminderDate, Timestamp.from(now));

        assertThat(orderRepository.findUnremindedOverdueOperationalPending(
                reminderCutoff.plusSeconds(86_400L)))
                .extracting(OrderEntity::getId)
                .doesNotContain(overdueOperational.getId(), historical.getId());

        assertThat(orderRepository.countOperationalByStatus("PENDING")).isEqualTo(2);
        assertThat(adminDashboardService.getDashboardSummary("30d").kpi().pendingOrders()).isEqualTo(2);
        assertThat(adminDashboardService.getDashboardSummary("30d").scopes().operational().includesHistoricalOrders())
                .isFalse();
        assertThat(adminOrderService.listAllowedTransitions(historical.getId())).isEmpty();
        assertThatThrownBy(() -> adminOrderService.updateOrderStatus(
                historical.getId(),
                UUID.randomUUID(),
                new UpdateOrderStatusRequest("PROCESSING", null),
                "127.0.0.1",
                "test"
        )).isInstanceOfSatisfying(ConflictException.class, exception ->
                assertThat(exception.code()).isEqualTo("HISTORICAL_ORDER_READ_ONLY"));
    }

    @Test
    void financialReportKeepsHistoricalOrdersAndDeclaresItsScope() {
        LocalDate today = LocalDate.now(VN_ZONE);
        Instant placedAt = today.atTime(12, 0).atZone(VN_ZONE).toInstant();
        OrderEntity historical = order("COMPLETED", "400000", placedAt, 202L);
        OrderEntity operational = order("COMPLETED", "600000", placedAt, null);
        orderRepository.saveAndFlush(historical);
        orderRepository.saveAndFlush(operational);
        UUID batchId = insertHistoryBatch();
        markHistorical(batchId, historical.getId());

        var report = adminReportService.getAnalytics(today.toString(), today.toString());

        assertThat(report.summary().grossOrderValue()).isEqualByComparingTo("1000000");
        assertThat(report.scope().orderScope()).isEqualTo("ALL");
        assertThat(report.scope().includesHistoricalOrders()).isTrue();
    }

    private UUID insertHistoryBatch() {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into order_history_batches (
                    id, batch_key, label_vi, label_en, reason_vi, reason_en, criteria_json,
                    expected_total, expected_pending, expected_processing, active,
                    created_at, activated_at
                ) values (?, 'LEGACY_WEB_IMPORT_2026_06_11', 'Đơn cũ', 'Historical orders',
                    'Giữ để tra cứu', 'Retained for lookup', '{}'::jsonb,
                    1660, 388, 508, true, now(), now())
                """, id);
        return id;
    }

    private int markHistorical(UUID batchId, UUID orderId) {
        return jdbcTemplate.update("""
                insert into order_history_batch_orders (batch_id, order_id)
                values (?, ?)
                on conflict (batch_id, order_id) do nothing
                """, batchId, orderId);
    }

    private OrderEntity order(String status, String total, Instant placedAt, Long legacyId) {
        OrderEntity order = new OrderEntity();
        order.setOrderNumber("OPS-" + UUID.randomUUID().toString().substring(0, 12));
        order.setStatus(status);
        order.setLegacyId(legacyId);
        order.setTotalAmount(new BigDecimal(total));
        order.setPaidAmount("COMPLETED".equals(status) ? new BigDecimal(total) : BigDecimal.ZERO);
        order.setPlacedAt(placedAt);
        order.setCreatedAt(placedAt);
        order.setUpdatedAt(placedAt);
        return order;
    }
}
