package com.bigbike.bigbike_backend.service.ws;

import com.bigbike.bigbike_backend.service.admin.AdminNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@Slf4j
@RequiredArgsConstructor
public class AdminOrderWsService {

    private static final String TOPIC_ORDERS = "/topic/admin/orders";

    private final SimpMessagingTemplate messaging;
    private final AdminNotificationService notificationService;

    public void pushEvent(OrderWsEvent event) {
        // Delay push until after the current transaction commits so
        // admin clients that refetch immediately see consistent DB state.
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    persistAndSend(event);
                }
            });
        } else {
            persistAndSend(event);
        }
    }

    /**
     * Pushes a notification that the caller has already stored atomically.
     * This keeps the live bell fresh without creating a second inbox row.
     */
    public void pushPersistedEvent(Object event) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    doSendPersisted(event);
                }
            });
        } else {
            doSendPersisted(event);
        }
    }

    private void persistAndSend(OrderWsEvent event) {
        try {
            notificationService.persistFromWsEvent(event);
        } catch (Exception e) {
            log.warn("Failed to persist admin notification for order {}: {}", event.orderNumber(), e.getMessage());
        }
        doSend(event);
    }

    private void doSend(OrderWsEvent event) {
        try {
            messaging.convertAndSend(TOPIC_ORDERS, event);
            log.debug("WS pushed {} for order {}", event.type(), event.orderNumber());
        } catch (Exception e) {
            log.warn("WS push failed for order {}: {}", event.orderNumber(), e.getMessage());
        }
    }

    private void doSendPersisted(Object event) {
        try {
            messaging.convertAndSend(TOPIC_ORDERS, event);
            log.debug("WS pushed an already-persisted admin order notification.");
        } catch (Exception e) {
            log.warn("WS push failed for an already-persisted admin order notification: {}", e.getMessage());
        }
    }
}
