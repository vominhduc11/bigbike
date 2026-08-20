package com.bigbike.bigbike_backend.service.audit;

import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@Slf4j
public class AuditLogRetentionCleanupService {

    static final int BATCH_SIZE = 500;
    private static final ZoneId VIETNAM_TIME = ZoneId.of("Asia/Ho_Chi_Minh");

    private final AuditLogJpaRepository auditLogRepo;
    private final TransactionTemplate transactionTemplate;

    public AuditLogRetentionCleanupService(
            AuditLogJpaRepository auditLogRepo, PlatformTransactionManager transactionManager) {
        this.auditLogRepo = auditLogRepo;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Scheduled(cron = "0 40 3 * * *", zone = "Asia/Ho_Chi_Minh")
    public void purgeExpiredAuditLogs() {
        Instant startedAt = Instant.now();
        Instant cutoff = ZonedDateTime.now(VIETNAM_TIME).minusMonths(12).toInstant();
        int total = 0;
        while (true) {
            Integer current = transactionTemplate.execute(
                    status -> auditLogRepo.deleteOlderThanBatch(cutoff, BATCH_SIZE));
            int deleted = current == null ? 0 : current;
            total += deleted;
            if (deleted < BATCH_SIZE) {
                break;
            }
        }
        log.info("Dọn nhật ký quản trị quá hạn: đã xoá {} dòng trong {} ms (mốc={}).",
                total, Duration.between(startedAt, Instant.now()).toMillis(), cutoff);
    }
}
