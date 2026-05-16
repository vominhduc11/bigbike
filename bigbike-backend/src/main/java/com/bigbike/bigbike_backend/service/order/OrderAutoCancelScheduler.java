package com.bigbike.bigbike_backend.service.order;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduled job that releases serial reservations held by stale BACS orders.
 *
 * Runs hourly at HH:10. Cron (rather than fixedDelay) keeps it well outside the
 * minute marks used by the serial reservation cleanup so the two never fire
 * back-to-back on the same row lock.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class OrderAutoCancelScheduler {

    private final OrderAutoCancelService service;

    @Scheduled(cron = "0 10 * * * ?")
    public void run() {
        try {
            int cancelled = service.autoCancelExpiredBacsUnpaidOrders();
            if (cancelled > 0) {
                log.info("[OrderAutoCancel] Auto-cancelled {} expired BACS unpaid order(s).", cancelled);
            }
        } catch (Exception e) {
            log.error("[OrderAutoCancel] Auto-cancel run failed: {}", e.getMessage(), e);
        }
    }
}
