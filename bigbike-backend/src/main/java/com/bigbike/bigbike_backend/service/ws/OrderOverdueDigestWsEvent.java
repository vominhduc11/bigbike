package com.bigbike.bigbike_backend.service.ws;

import java.time.Instant;
import java.util.UUID;

/** Live companion for an already-persisted daily order reminder. */
public record OrderOverdueDigestWsEvent(
        UUID id,
        String type,
        int count,
        int thresholdDays,
        Instant cutoffAt,
        Instant timestamp
) {}
