package com.bigbike.bigbike_backend.service.receivable;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduled task that flags overdue receivables.
 * Implements AR_RULE_008: "Overdue receivables are flagged by scheduler."
 *
 * Runs daily at 00:05 — safely after midnight so any due-date transitions
 * from the previous day are captured on the first run.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class ReceivableOverdueScheduler {

    private final ReceivableService receivableService;
    private final ReceivableNotificationService notificationService;

    @Scheduled(cron = "0 5 0 * * ?")
    public void refreshOverdueReceivables() {
        log.info("ReceivableOverdueScheduler: starting overdue refresh...");
        int updated = receivableService.refreshOverdueStatus();
        if (updated > 0) {
            log.info("ReceivableOverdueScheduler: flagged {} receivable(s) as OVERDUE.", updated);
        } else {
            log.info("ReceivableOverdueScheduler: no receivables transitioned to OVERDUE.");
        }
        // Send daily digest of ALL currently overdue receivables to admin
        try {
            notificationService.sendOverdueDigestIfAny();
        } catch (Exception e) {
            log.warn("ReceivableOverdueScheduler: failed to send overdue digest: {}", e.getMessage());
        }
    }
}
