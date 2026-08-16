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
public class AdminChatWsService {

    private static final String TOPIC_CHAT = "/topic/admin/chat";

    private final SimpMessagingTemplate messaging;
    private final AdminNotificationService notificationService;

    public void pushLead(ChatLeadWsEvent event) {
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

    private void persistAndSend(ChatLeadWsEvent event) {
        try {
            notificationService.persistChatLead(event);
        } catch (RuntimeException exception) {
            log.warn("Could not persist BigBike Assistant lead notification for conversation {}",
                    event.conversationId());
        }
        try {
            messaging.convertAndSend(TOPIC_CHAT, event);
        } catch (RuntimeException exception) {
            log.warn("Could not push BigBike Assistant lead notification for conversation {}",
                    event.conversationId());
        }
    }
}
