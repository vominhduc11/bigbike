package com.bigbike.bigbike_backend.service.checkout;

import com.bigbike.bigbike_backend.persistence.repository.commerce.order.CheckoutIdempotencyKeyJpaRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class CheckoutIdempotencyKeyCleanupScheduler {

    private final CheckoutIdempotencyKeyJpaRepository idempotencyKeyRepo;

    public CheckoutIdempotencyKeyCleanupScheduler(CheckoutIdempotencyKeyJpaRepository idempotencyKeyRepo) {
        this.idempotencyKeyRepo = idempotencyKeyRepo;
    }

    // Runs daily at 02:30 — removes idempotency keys older than 90 days
    @Scheduled(cron = "0 30 2 * * *")
    @Transactional
    public void cleanup() {
        Instant cutoff = Instant.now().minus(90, ChronoUnit.DAYS);
        int deleted = idempotencyKeyRepo.deleteOlderThan(cutoff);
        if (deleted > 0) {
            LoggerFactory.getLogger(CheckoutIdempotencyKeyCleanupScheduler.class)
                    .info("Purged {} expired checkout idempotency key(s) older than 90 days.", deleted);
        }
    }
}
