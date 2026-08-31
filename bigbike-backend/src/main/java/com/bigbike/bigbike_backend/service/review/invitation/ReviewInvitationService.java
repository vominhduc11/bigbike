package com.bigbike.bigbike_backend.service.review.invitation;

import java.time.Instant;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReviewInvitationService {

    private final ReviewInvitationStore store;
    private final ReviewInvitationEmailService emailService;
    private final ReviewInvitationClock clock;

    public int queueEligibleOrders() {
        return store.queueEligibleOrders(clock.now());
    }

    public boolean dispatchOne() {
        Optional<ReviewInvitationDispatchClaim> claim = store.claimNext(
                clock.now(), clock.todayInVietnam());
        if (claim.isEmpty()) {
            return false;
        }

        boolean accepted = false;
        try {
            accepted = emailService.send(claim.get());
        } catch (RuntimeException exception) {
            // No token, email address, or provider credential is logged here.
            log.warn("Review invitation dispatch failed before a provider result: deliveryId={}",
                    claim.get().deliveryId());
        }
        store.completeAttempt(claim.get().deliveryId(), accepted, clock.now());
        return true;
    }

    public void unsubscribe(String token) {
        store.unsubscribe(token, clock.now());
    }

    public void consumeInviteToken(String token, String productId, Long reviewId, Instant reviewedAt) {
        store.consumeInviteToken(token, productId, reviewId, reviewedAt);
    }

    public void skipRefunded(java.util.UUID deliveryId) {
        store.skipRefunded(deliveryId, clock.now());
    }
}
