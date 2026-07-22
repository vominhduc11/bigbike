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
public class AdminCustomerWsService {

    private static final String TOPIC_CUSTOMERS = "/topic/admin/customers";

    private final SimpMessagingTemplate messaging;

    public void pushEvent(CustomerWsEvent event) {
        // Delay push until the registration transaction commits so the Customer
        // screen refetch always observes the persisted customer and KPI state.
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

    private void doSend(CustomerWsEvent event) {
        try {
            messaging.convertAndSend(TOPIC_CUSTOMERS, event);
            log.debug("WS pushed {} for customer {}", event.type(), event.customerId());
        } catch (Exception e) {
            log.warn("WS customer push failed for customer {}: {}", event.customerId(), e.getMessage());
        }
    }
}
