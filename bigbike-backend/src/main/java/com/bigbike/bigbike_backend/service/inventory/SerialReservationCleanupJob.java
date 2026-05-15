package com.bigbike.bigbike_backend.service.inventory;

import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduled job: releases RESERVED serials whose TTL has expired.
 * Runs every minute. Safe to run on multiple instances — SerialLifecycleService
 * uses FOR UPDATE SKIP LOCKED so concurrent runs skip rows locked by another node.
 */
@Component
public class SerialReservationCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(SerialReservationCleanupJob.class);

    private final SerialLifecycleService serialLifecycleService;
    private final WebRevalidationService webRevalidationService;

    public SerialReservationCleanupJob(
            SerialLifecycleService serialLifecycleService,
            WebRevalidationService webRevalidationService) {
        this.serialLifecycleService = serialLifecycleService;
        this.webRevalidationService = webRevalidationService;
    }

    @Scheduled(fixedDelayString = "${inventory.reservation.cleanup-interval-ms:60000}")
    public void releaseExpiredReservations() {
        try {
            List<String> affectedProductPks = serialLifecycleService.releaseExpiredReservations();
            if (!affectedProductPks.isEmpty()) {
                log.info("[SerialCleanupJob] Released {} expired serial reservations.", affectedProductPks.size());
                webRevalidationService.revalidateProductsByIds(affectedProductPks);
            }
        } catch (Exception e) {
            log.error("[SerialCleanupJob] Failed to release expired reservations: {}", e.getMessage(), e);
        }
    }
}
