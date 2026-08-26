package com.bigbike.bigbike_backend.service.ws;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ChatHandoffWsEvent(
        String type,
        UUID handoffId,
        UUID conversationId,
        String questionSummary,
        List<ProductReference> products,
        boolean contactPresent,
        String customerKind,
        Instant requestedAt,
        long waitingCount
) {
    public record ProductReference(String slug, String name) {}

    public ChatHandoffWsEvent {
        products = products == null ? List.of() : List.copyOf(products);
    }
}
