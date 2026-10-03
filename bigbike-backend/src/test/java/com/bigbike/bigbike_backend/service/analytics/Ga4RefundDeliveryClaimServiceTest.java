package com.bigbike.bigbike_backend.service.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.analytics.Ga4EventOutboxEntity;
import com.bigbike.bigbike_backend.persistence.repository.analytics.Ga4EventOutboxJpaRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class Ga4RefundDeliveryClaimServiceTest {

    @Mock Ga4EventOutboxJpaRepository repository;
    private Ga4RefundDeliveryClaimService service;

    @BeforeEach
    void setUp() {
        service = new Ga4RefundDeliveryClaimService(repository);
    }

    @Test
    void claimMakesPendingEventNonResendableBeforeReturningPayload() {
        Ga4EventOutboxEntity event = event("PENDING");
        when(repository.findNextPendingForUpdate(any())).thenReturn(Optional.of(event));

        var claim = service.claimNext();

        assertThat(claim.eventId()).isEqualTo(event.getId());
        assertThat(claim.payloadJson()).isEqualTo(event.getPayloadJson());
        assertThat(event.getStatus()).isEqualTo("SENDING");
        assertThat(event.getAttemptCount()).isEqualTo(1);
        assertThat(event.getLastAttemptAt()).isNotNull();
        verify(repository).save(event);
    }

    @Test
    void finalizesClaimAsSentOrFailedWithoutMakingItPendingAgain() {
        Ga4EventOutboxEntity sent = event("SENDING");
        when(repository.findById(sent.getId())).thenReturn(Optional.of(sent));

        service.markSent(sent.getId());

        assertThat(sent.getStatus()).isEqualTo("SENT");
        assertThat(sent.getSentAt()).isNotNull();

        Ga4EventOutboxEntity failed = event("SENDING");
        when(repository.findById(failed.getId())).thenReturn(Optional.of(failed));

        service.markFailed(failed.getId(), "NETWORK");

        assertThat(failed.getStatus()).isEqualTo("FAILED");
        assertThat(failed.getLastErrorCode()).isEqualTo("NETWORK");
    }

    private static Ga4EventOutboxEntity event(String status) {
        Ga4EventOutboxEntity event = new Ga4EventOutboxEntity();
        event.setId(UUID.randomUUID());
        event.setOrderId(UUID.randomUUID());
        event.setEventName("refund");
        event.setPayloadJson("{\"events\":[{\"name\":\"refund\"}]}");
        event.setStatus(status);
        event.setNextAttemptAt(Instant.now());
        event.setCreatedAt(Instant.now());
        event.setUpdatedAt(Instant.now());
        return event;
    }
}
