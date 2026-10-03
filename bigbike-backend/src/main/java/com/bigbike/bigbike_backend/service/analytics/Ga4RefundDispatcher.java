package com.bigbike.bigbike_backend.service.analytics;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class Ga4RefundDispatcher {

    private static final int MAX_EVENTS_PER_RUN = 25;
    private final Ga4RefundDeliveryService deliveryService;

    @Scheduled(
            fixedDelayString = "${bigbike.analytics.ga4.dispatch-delay-ms:30000}",
            initialDelayString = "${bigbike.analytics.ga4.dispatch-delay-ms:30000}"
    )
    public void dispatchDueEvents() {
        for (int sent = 0; sent < MAX_EVENTS_PER_RUN; sent++) {
            if (!deliveryService.dispatchNext()) return;
        }
    }
}
