package com.bigbike.bigbike_backend.service.ws;

import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** Uses the existing STOMP broker; REST/history remains the authoritative message source. */
@Service
@RequiredArgsConstructor
@Slf4j
public class CustomerChatWsService {

    private final SimpMessagingTemplate messaging;

    public void push(UUID conversationId, String type, long sequenceNo, String channelState) {
        Runnable send = () -> {
            try {
                messaging.convertAndSendToUser(
                        "chat:" + conversationId,
                        "/queue/chat",
                        new Event(type, conversationId, sequenceNo, channelState, Instant.now()));
            } catch (RuntimeException exception) {
                log.warn("Could not push customer chat update for conversation {}", conversationId);
            }
        };
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { send.run(); }
            });
        } else {
            send.run();
        }
    }

    public record Event(
            String type,
            UUID conversationId,
            long latestSequence,
            String channelState,
            Instant occurredAt
    ) {}
}
