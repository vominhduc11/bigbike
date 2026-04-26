package com.bigbike.bigbike_backend.service.ws;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class AdminOrderWsService {

    private static final Logger log = LoggerFactory.getLogger(AdminOrderWsService.class);
    private static final String TOPIC_ORDERS = "/topic/admin/orders";

    private final SimpMessagingTemplate messaging;

    public AdminOrderWsService(SimpMessagingTemplate messaging) {
        this.messaging = messaging;
    }

    public void pushEvent(OrderWsEvent event) {
        // Delay push until after the current transaction commits so
        // admin clients that refetch immediately see consistent DB state.
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

    private void doSend(OrderWsEvent event) {
        try {
            messaging.convertAndSend(TOPIC_ORDERS, event);
            log.debug("WS pushed {} for order {}", event.type(), event.orderNumber());
        } catch (Exception e) {
            log.warn("WS push failed for order {}: {}", event.orderNumber(), e.getMessage());
        }
    }
}
