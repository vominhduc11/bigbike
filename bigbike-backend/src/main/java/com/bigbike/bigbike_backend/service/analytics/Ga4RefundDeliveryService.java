package com.bigbike.bigbike_backend.service.analytics;

import com.bigbike.bigbike_backend.service.analytics.Ga4RefundDeliveryClaimService.DeliveryClaim;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class Ga4RefundDeliveryService {

    private final Ga4RefundDeliveryClaimService claimService;
    private final Ga4MeasurementClient measurementClient;

    public boolean dispatchNext() {
        if (!measurementClient.isEnabled()) return false;
        DeliveryClaim claim = claimService.claimNext();
        if (claim == null) return false;

        try {
            measurementClient.send(claim.payloadJson());
        } catch (Ga4MeasurementClient.DeliveryException exception) {
            claimService.markFailed(claim.eventId(), exception.code());
            return true;
        } catch (RuntimeException exception) {
            claimService.markFailed(claim.eventId(), "UNEXPECTED");
            return true;
        }
        // Keep finalization outside the delivery catch. If the database becomes unavailable after
        // Google accepted the event, the committed SENDING claim remains terminal and visible for
        // manual reconciliation instead of being converted into an automatically resendable row.
        claimService.markSent(claim.eventId());
        return true;
    }
}
