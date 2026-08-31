package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderOverdueReminderOrderEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderOverdueReminderOrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderOverdueReminderRunJpaRepository;
import com.bigbike.bigbike_backend.service.ws.AdminOrderWsService;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.OptionalInt;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class OrderOverdueReminderServiceTest {

    @Mock OrderHistoryClassificationService historyClassificationService;
    @Mock OrderOperationsSettings orderOperationsSettings;
    @Mock OrderJpaRepository orderRepository;
    @Mock OrderOverdueReminderRunJpaRepository runRepository;
    @Mock OrderOverdueReminderOrderJpaRepository reminderOrderRepository;
    @Mock AdminNotificationService notificationService;
    @Mock AdminOrderWsService adminOrderWsService;

    private OrderOverdueReminderService service;

    @BeforeEach
    void setUp() {
        service = new OrderOverdueReminderService(
                historyClassificationService,
                orderOperationsSettings,
                orderRepository,
                runRepository,
                reminderOrderRepository,
                notificationService,
                adminOrderWsService
        );
    }

    @Test
    void skipsSafelyUntilTheHistoricalBatchHasBeenClassified() {
        Instant now = Instant.parse("2026-08-31T00:00:00Z");
        when(historyClassificationService.hasActiveBatch()).thenReturn(false);

        var result = service.runDailyAt(now);

        assertThat(result.outcome())
                .isEqualTo(OrderOverdueReminderService.Outcome.NO_ACTIVE_HISTORY_BATCH);
        verifyNoInteractions(orderOperationsSettings, orderRepository, runRepository,
                reminderOrderRepository, notificationService, adminOrderWsService);
    }

    @Test
    void overdueOperationalOrdersProduceOneDigestAndAreNotRemindedAgain() {
        Instant now = Instant.parse("2026-08-31T00:00:00Z");
        UUID notificationId = UUID.randomUUID();
        OrderEntity overdue = new OrderEntity();
        overdue.setId(UUID.randomUUID());

        when(historyClassificationService.hasActiveBatch()).thenReturn(true);
        when(orderOperationsSettings.overdueDays()).thenReturn(OptionalInt.of(2));
        when(runRepository.claim(any(LocalDate.class), eq(2), any(Instant.class), any(Instant.class)))
                .thenReturn(1, 0);
        when(orderRepository.findUnremindedOverdueOperationalPending(
                Instant.parse("2026-08-29T00:00:00Z")))
                .thenReturn(List.of(overdue));
        when(notificationService.persistOverdueOrderDigest(
                1, 2, Instant.parse("2026-08-29T00:00:00Z")))
                .thenReturn(notificationId);

        var first = service.runDailyAt(now);
        var second = service.runDailyAt(now.plusSeconds(60));

        assertThat(first.outcome()).isEqualTo(OrderOverdueReminderService.Outcome.NOTIFIED);
        assertThat(first.count()).isEqualTo(1);
        assertThat(first.notificationId()).isEqualTo(notificationId);
        assertThat(second.outcome()).isEqualTo(OrderOverdueReminderService.Outcome.ALREADY_RAN);
        verify(notificationService, times(1))
                .persistOverdueOrderDigest(1, 2, Instant.parse("2026-08-29T00:00:00Z"));
        verify(adminOrderWsService, times(1)).pushPersistedEvent(any());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<OrderOverdueReminderOrderEntity>> rows = ArgumentCaptor.forClass(List.class);
        verify(reminderOrderRepository).saveAll(rows.capture());
        assertThat(rows.getValue()).singleElement().satisfies(reminder -> {
            assertThat(reminder.getOrderId()).isEqualTo(overdue.getId());
            assertThat(reminder.getRunDate()).isEqualTo(LocalDate.of(2026, 8, 31));
        });
    }

    @Test
    void noOverdueOrderMeansNoNotification() {
        Instant now = Instant.parse("2026-08-31T00:00:00Z");
        when(historyClassificationService.hasActiveBatch()).thenReturn(true);
        when(orderOperationsSettings.overdueDays()).thenReturn(OptionalInt.of(2));
        when(runRepository.claim(any(LocalDate.class), eq(2), any(Instant.class), eq(now)))
                .thenReturn(1);
        when(orderRepository.findUnremindedOverdueOperationalPending(
                Instant.parse("2026-08-29T00:00:00Z")))
                .thenReturn(List.of());

        var result = service.runDailyAt(now);

        assertThat(result.outcome()).isEqualTo(OrderOverdueReminderService.Outcome.EMPTY);
        verify(runRepository).complete(LocalDate.of(2026, 8, 31), 0, null, now);
        verify(notificationService, never()).persistOverdueOrderDigest(anyInt(), anyInt(), any());
        verifyNoInteractions(reminderOrderRepository, adminOrderWsService);
    }

    @Test
    void ordersStillWithinTheConfiguredWindowProduceNoNotification() {
        Instant now = Instant.parse("2026-08-31T00:00:00Z");
        when(historyClassificationService.hasActiveBatch()).thenReturn(true);
        when(orderOperationsSettings.overdueDays()).thenReturn(OptionalInt.of(4));
        when(runRepository.claim(any(LocalDate.class), eq(4), any(Instant.class), eq(now)))
                .thenReturn(1);
        when(orderRepository.findUnremindedOverdueOperationalPending(
                Instant.parse("2026-08-27T00:00:00Z")))
                .thenReturn(List.of());

        var result = service.runDailyAt(now);

        assertThat(result.outcome()).isEqualTo(OrderOverdueReminderService.Outcome.EMPTY);
        verify(notificationService, never()).persistOverdueOrderDigest(anyInt(), anyInt(), any());
    }
}
