package com.bigbike.bigbike_backend.service.analytics;

import com.bigbike.bigbike_backend.persistence.entity.analytics.Ga4EventOutboxEntity;
import com.bigbike.bigbike_backend.persistence.repository.analytics.Ga4EventOutboxJpaRepository;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Owns the short database transactions around a GA4 delivery.
 *
 * <p>The claim transaction commits {@code SENDING} before the network call starts. Consequently a
 * lost process or response can leave a row for manual reconciliation, but can never make the
 * scheduler automatically send an ambiguous refund twice.
 */
@Service
@RequiredArgsConstructor
public class Ga4RefundDeliveryClaimService {

    private final Ga4EventOutboxJpaRepository outboxRepository;

    @Transactional
    public DeliveryClaim claimNext() {
        Instant now = Instant.now();
        Ga4EventOutboxEntity event = outboxRepository.findNextPendingForUpdate(now).orElse(null);
        if (event == null) return null;

        event.setStatus("SENDING");
        event.setAttemptCount(event.getAttemptCount() + 1);
        event.setLastAttemptAt(now);
        event.setLastErrorCode(null);
        event.setUpdatedAt(now);
        outboxRepository.save(event);
        return new DeliveryClaim(event.getId(), event.getPayloadJson());
    }

    @Transactional
    public void markSent(UUID eventId) {
        Ga4EventOutboxEntity event = requireSending(eventId);
        Instant now = Instant.now();
        event.setStatus("SENT");
        event.setSentAt(now);
        event.setUpdatedAt(now);
        outboxRepository.save(event);
    }

    @Transactional
    public void markFailed(UUID eventId, String errorCode) {
        Ga4EventOutboxEntity event = requireSending(eventId);
        event.setStatus("FAILED");
        event.setLastErrorCode(errorCode);
        event.setUpdatedAt(Instant.now());
        outboxRepository.save(event);
    }

    private Ga4EventOutboxEntity requireSending(UUID eventId) {
        Ga4EventOutboxEntity event = outboxRepository.findById(eventId)
                .orElseThrow(() -> new IllegalStateException("Claimed GA4 event no longer exists."));
        if (!"SENDING".equals(event.getStatus())) {
            throw new IllegalStateException("Claimed GA4 event is no longer SENDING.");
        }
        return event;
    }

    public record DeliveryClaim(UUID eventId, String payloadJson) {}
}
