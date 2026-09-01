package com.bigbike.bigbike_backend.service.review.invitation;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class ReviewInvitationScheduler {

    private final ReviewInvitationService reviewInvitationService;
    private final ReviewInvitationLifecycleService lifecycleService;
    private final ReviewInvitationClock clock;

    @Scheduled(cron = "0 30 4 * * *", zone = "Asia/Ho_Chi_Minh")
    public void queueNightly() {
        lifecycleService.synchronize(clock.now());
        int queued = reviewInvitationService.queueEligibleOrders();
        if (queued > 0) {
            log.info("Queued post-purchase review invitations: count={}", queued);
        }
    }

    @Scheduled(cron = "0 */10 9-20 * * *", zone = "Asia/Ho_Chi_Minh")
    public void dispatchPaced() {
        lifecycleService.synchronize(clock.now());
        reviewInvitationService.dispatchOne();
    }
}
