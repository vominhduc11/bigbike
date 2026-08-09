package com.bigbike.bigbike_backend.service.ws;

import java.time.Instant;
import java.util.UUID;

public record ChatLeadWsEvent(
        String type,
        UUID conversationId,
        String name,
        String phone,
        String note,
        Instant timestamp
) {}
