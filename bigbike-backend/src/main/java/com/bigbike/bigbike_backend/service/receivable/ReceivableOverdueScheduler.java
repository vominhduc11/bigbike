package com.bigbike.bigbike_backend.service.receivable;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
public class ReceivableOverdueScheduler {

    private static final Logger log = LoggerFactory.getLogger(ReceivableOverdueScheduler.class);

    private final ReceivableService receivableService;

    public ReceivableOverdueScheduler(ReceivableService receivableService) {
        this.receivableService = receivableService;
    }

    @Scheduled(cron = "0 5 0 * * ?")
    public void refreshOverdueReceivables() {
        log.info("ReceivableOverdueScheduler: starting overdue refresh...");
        int updated = receivableService.refreshOverdueStatus();
        if (updated > 0) {
            log.info("ReceivableOverdueScheduler: flagged {} receivable(s) as OVERDUE.", updated);
        } else {
            log.info("ReceivableOverdueScheduler: no receivables transitioned to OVERDUE.");
        }
    }
}
