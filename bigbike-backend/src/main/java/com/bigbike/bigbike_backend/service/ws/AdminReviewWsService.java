package com.bigbike.bigbike_backend.service.ws;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@Slf4j
@RequiredArgsConstructor
public class AdminReviewWsService {

    private static final String TOPIC_REVIEWS = "/topic/admin/reviews";

    private final SimpMessagingTemplate messaging;

    public void pushEvent(ReviewWsEvent event) {
        // Delay push until the current transaction commits so the Review screen
        // refetch always observes the persisted review and summary state.
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    doSend(event);
                }
            });
        } else {
            doSend(event);
        }
    }

    private void doSend(ReviewWsEvent event) {
        try {
            messaging.convertAndSend(TOPIC_REVIEWS, event);
            log.debug("WS pushed {} for review {}", event.type(), event.reviewId());
        } catch (Exception e) {
            log.warn("WS review push failed for review {}: {}", event.reviewId(), e.getMessage());
        }
    }
}
