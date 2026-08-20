package com.bigbike.bigbike_backend.service.cart;

import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartJpaRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Dọn theo các giao dịch nhỏ, độc lập để không giữ kho dữ liệu quá lâu khi shop đang bận. */
@Service
@Slf4j
public class CartRetentionCleanupService {

    static final int BATCH_SIZE = 500;

    private final CartJpaRepository cartRepo;
    private final TransactionTemplate transactionTemplate;

    public CartRetentionCleanupService(CartJpaRepository cartRepo, PlatformTransactionManager transactionManager) {
        this.cartRepo = cartRepo;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Scheduled(cron = "0 45 2 * * *", zone = "Asia/Ho_Chi_Minh")
    public void purgeExpiredCarts() {
        Instant startedAt = Instant.now();
        Instant cutoff = startedAt;
        int deleted = deleteInBatches(() -> cartRepo.deleteExpiredRetentionBatch(cutoff, BATCH_SIZE));
        log.info("Dọn giỏ hết hạn: đã xoá {} giỏ trong {} ms (mốc={}).",
                deleted, Duration.between(startedAt, Instant.now()).toMillis(), cutoff);
    }

    @Scheduled(cron = "0 15 3 * * *", zone = "Asia/Ho_Chi_Minh")
    public void purgeExpiredBackups() {
        Instant startedAt = Instant.now();
        Instant cutoff = startedAt.minus(90, ChronoUnit.DAYS);
        int deleted = deleteInBatches(() -> cartRepo.deleteExpiredPurgeBackupRunsBatch(cutoff, BATCH_SIZE));
        log.info("Dọn bản sao lưu giỏ: đã xoá {} lần dọn trong {} ms (mốc={}).",
                deleted, Duration.between(startedAt, Instant.now()).toMillis(), cutoff);
    }

    private int deleteInBatches(BatchDelete batchDelete) {
        int total = 0;
        while (true) {
            Integer current = transactionTemplate.execute(status -> batchDelete.delete());
            int deleted = current == null ? 0 : current;
            total += deleted;
            if (deleted < BATCH_SIZE) {
                return total;
            }
        }
    }

    @FunctionalInterface
    private interface BatchDelete {
        int delete();
    }
}
