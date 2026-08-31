package com.bigbike.bigbike_backend.service.admin;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrderOverdueReminderScheduler {

    private final OrderOverdueReminderService reminderService;

    @Scheduled(cron = "0 20 4 * * *", zone = "Asia/Ho_Chi_Minh")
    public void remindOverdueOrders() {
        OrderOverdueReminderService.Result result = reminderService.runDaily();
        log.info("Overdue order reminder completed: date={}, outcome={}, count={}",
                result.runDate(), result.outcome(), result.count());
    }
}
