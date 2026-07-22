package com.bigbike.bigbike_backend.service.ws;

import java.time.Instant;

public record AdminPresenceEvent(
        String action,
        String entityType,
        String entityId,
        int activeAdminCount,
        Instant timestamp
) {}
