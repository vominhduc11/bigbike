package com.bigbike.bigbike_backend.service.review.invitation;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ReviewInvitationSchedulerTest {

    private static final Instant NOW = Instant.parse("2026-09-01T02:00:00Z");

    @Mock private ReviewInvitationService reviewInvitationService;
    @Mock private ReviewInvitationLifecycleService lifecycleService;
    @Mock private ReviewInvitationClock clock;

    @InjectMocks private ReviewInvitationScheduler scheduler;

    @Test
    void nightlyCallbackSynchronizesLifecycleBeforeQueueing() {
        when(clock.now()).thenReturn(NOW);

        scheduler.queueNightly();

        InOrder order = inOrder(lifecycleService, reviewInvitationService);
        order.verify(lifecycleService).synchronize(NOW);
        order.verify(reviewInvitationService).queueEligibleOrders();
    }

    @Test
    void pacedCallbackSynchronizesLifecycleBeforeDispatching() {
        when(clock.now()).thenReturn(NOW);

        scheduler.dispatchPaced();

        InOrder order = inOrder(lifecycleService, reviewInvitationService);
        order.verify(lifecycleService).synchronize(NOW);
        order.verify(reviewInvitationService).dispatchOne();
    }
}
