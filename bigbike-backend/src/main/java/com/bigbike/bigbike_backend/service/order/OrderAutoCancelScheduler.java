package com.bigbike.bigbike_backend.service.order;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
public class OrderAutoCancelScheduler {

    private static final Logger log = LoggerFactory.getLogger(OrderAutoCancelScheduler.class);

    private final OrderAutoCancelService service;

    public OrderAutoCancelScheduler(OrderAutoCancelService service) {
        this.service = service;
    }

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
