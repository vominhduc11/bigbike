package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderOverdueReminderOrderEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderOverdueReminderOrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderOverdueReminderRunJpaRepository;
import com.bigbike.bigbike_backend.service.ws.AdminOrderWsService;
import com.bigbike.bigbike_backend.service.ws.OrderOverdueDigestWsEvent;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.OptionalInt;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderOverdueReminderService {

    static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final OrderHistoryClassificationService historyClassificationService;
    private final OrderOperationsSettings orderOperationsSettings;
    private final OrderJpaRepository orderRepository;
    private final OrderOverdueReminderRunJpaRepository runRepository;
    private final OrderOverdueReminderOrderJpaRepository reminderOrderRepository;
    private final AdminNotificationService notificationService;
    private final AdminOrderWsService adminOrderWsService;

    public enum Outcome {
        NOTIFIED,
        EMPTY,
        ALREADY_RAN,
        NO_ACTIVE_HISTORY_BATCH,
        INVALID_SETTING
    }

    public record Result(Outcome outcome, LocalDate runDate, int count, UUID notificationId) {}

    @Transactional
    public Result runDaily() {
        return runDailyAt(Instant.now());
    }

    @Transactional
    public Result runDailyAt(Instant now) {
        LocalDate runDate = now.atZone(VN_ZONE).toLocalDate();
        if (!historyClassificationService.hasActiveBatch()) {
            log.warn("Order overdue reminder skipped for {}: no active historical-order batch.", runDate);
            return new Result(Outcome.NO_ACTIVE_HISTORY_BATCH, runDate, 0, null);
        }

        OptionalInt configuredDays = orderOperationsSettings.overdueDays();
        if (configuredDays.isEmpty()) {
            return new Result(Outcome.INVALID_SETTING, runDate, 0, null);
        }

        int thresholdDays = configuredDays.getAsInt();
        Instant cutoff;
        try {
            cutoff = now.minus(Duration.ofDays(thresholdDays));
        } catch (DateTimeException | ArithmeticException exception) {
            log.error("Order overdue reminder skipped for {}: configured threshold is out of range.", runDate);
            return new Result(Outcome.INVALID_SETTING, runDate, 0, null);
        }

        if (runRepository.claim(runDate, thresholdDays, cutoff, now) == 0) {
            return new Result(Outcome.ALREADY_RAN, runDate, 0, null);
        }

        var candidates = orderRepository.findUnremindedOverdueOperationalPending(cutoff);
        if (candidates.isEmpty()) {
            runRepository.complete(runDate, 0, null, now);
            return new Result(Outcome.EMPTY, runDate, 0, null);
        }

        UUID notificationId = notificationService.persistOverdueOrderDigest(
                candidates.size(), thresholdDays, cutoff);

        var reminderRows = candidates.stream().map(order -> {
            OrderOverdueReminderOrderEntity reminder = new OrderOverdueReminderOrderEntity();
            reminder.setOrderId(order.getId());
            reminder.setRunDate(runDate);
            reminder.setRemindedAt(now);
            return reminder;
        }).toList();
        reminderOrderRepository.saveAll(reminderRows);
        runRepository.complete(runDate, candidates.size(), notificationId, now);
        adminOrderWsService.pushPersistedEvent(new OrderOverdueDigestWsEvent(
                notificationId,
                "ORDER_OVERDUE_DIGEST",
                candidates.size(),
                thresholdDays,
                cutoff,
                now
        ));

        return new Result(Outcome.NOTIFIED, runDate, candidates.size(), notificationId);
    }
}
