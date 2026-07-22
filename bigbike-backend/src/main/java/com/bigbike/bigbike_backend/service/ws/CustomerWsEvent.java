package com.bigbike.bigbike_backend.service.ws;

import java.time.Instant;
import java.util.UUID;

public record CustomerWsEvent(
        String type,
        UUID customerId,
        String status,
        Instant timestamp
) {}
