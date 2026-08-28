package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.persistence.repository.admin.AdminNotificationJpaRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Dọn kho thông báo theo các giao dịch nhỏ, không ảnh hưởng mốc đã đọc của từng admin. */
@Service
@Slf4j
public class AdminNotificationRetentionCleanupService {

    static final int BATCH_SIZE = 500;
    private static final ZoneId VIETNAM_TIME = ZoneId.of("Asia/Ho_Chi_Minh");

    private final AdminNotificationJpaRepository notificationRepo;
    private final TransactionTemplate transactionTemplate;

    public AdminNotificationRetentionCleanupService(
            AdminNotificationJpaRepository notificationRepo,
            PlatformTransactionManager transactionManager) {
        this.notificationRepo = notificationRepo;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Scheduled(cron = "0 50 3 * * *", zone = "Asia/Ho_Chi_Minh")
    public void purgeExpiredNotifications() {
        Instant startedAt = Instant.now();
        Instant cutoff = ZonedDateTime.now(VIETNAM_TIME).minusMonths(6).toInstant();
        int total = deleteInBatches(() -> notificationRepo.deleteOlderThanBatch(cutoff, BATCH_SIZE));

        log.info("Dọn thông báo quản trị quá hạn: đã xoá {} dòng trong {} ms (mốc={}).",
                total, Duration.between(startedAt, Instant.now()).toMillis(), cutoff);
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
