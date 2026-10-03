package com.bigbike.bigbike_backend.service.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.service.analytics.Ga4RefundDeliveryClaimService.DeliveryClaim;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class Ga4RefundDeliveryServiceTest {

    @Mock Ga4RefundDeliveryClaimService claimService;
    @Mock Ga4MeasurementClient client;
    private Ga4RefundDeliveryService service;

    @BeforeEach
    void setUp() {
        service = new Ga4RefundDeliveryService(claimService, client);
    }

    @Test
    void marksAcceptedPayloadSent() {
        DeliveryClaim claim = claim();
        when(client.isEnabled()).thenReturn(true);
        when(claimService.claimNext()).thenReturn(claim);

        assertThat(service.dispatchNext()).isTrue();

        verify(client).send(claim.payloadJson());
        verify(claimService).markSent(claim.eventId());
        verify(claimService, never()).markFailed(any(), any());
    }

    @Test
    void failedOrUncertainRequestIsTerminalAndNeverClaimedAgainAutomatically() {
        DeliveryClaim claim = claim();
        when(client.isEnabled()).thenReturn(true);
        when(claimService.claimNext()).thenReturn(claim).thenReturn(null);
        org.mockito.Mockito.doThrow(new Ga4MeasurementClient.DeliveryException("HTTP_503"))
                .when(client).send(any());

        assertThat(service.dispatchNext()).isTrue();
        assertThat(service.dispatchNext()).isFalse();

        verify(client, times(1)).send(claim.payloadJson());
        verify(claimService).markFailed(claim.eventId(), "HTTP_503");
        verify(claimService, never()).markSent(any());
    }

    @Test
    void unexpectedDeliveryFailureIsTerminal() {
        DeliveryClaim claim = claim();
        when(client.isEnabled()).thenReturn(true);
        when(claimService.claimNext()).thenReturn(claim);
        org.mockito.Mockito.doThrow(new IllegalStateException("connection state unknown"))
                .when(client).send(any());

        assertThat(service.dispatchNext()).isTrue();

        verify(claimService).markFailed(claim.eventId(), "UNEXPECTED");
        verify(claimService, never()).markSent(any());
    }

    @Test
    void disabledClientLeavesPendingRowsUntouched() {
        when(client.isEnabled()).thenReturn(false);

        assertThat(service.dispatchNext()).isFalse();

        verify(client).isEnabled();
        verify(claimService, never()).claimNext();
    }

    private static DeliveryClaim claim() {
        return new DeliveryClaim(
                UUID.randomUUID(), "{\"events\":[{\"name\":\"refund\"}]}");
    }
}
