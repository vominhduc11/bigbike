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
public class AdminInventoryWsService {

    private static final String TOPIC_INVENTORY = "/topic/admin/inventory";

    private final SimpMessagingTemplate messaging;

    public void pushEvent(InventoryWsEvent event) {
        // Delay push until the current transaction commits so the Dashboard
        // refetch always observes the persisted availability state.
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

    private void doSend(InventoryWsEvent event) {
        try {
            messaging.convertAndSend(TOPIC_INVENTORY, event);
            log.debug("WS pushed {} for product {}", event.type(), event.productId());
        } catch (Exception e) {
            log.warn("WS inventory push failed for product {}: {}", event.productId(), e.getMessage());
        }
    }
}
