package com.bigbike.bigbike_backend.api.chat.dto;

import java.time.Instant;
import java.util.UUID;

public record ChatHandoffResponse(
        UUID handoffId,
        UUID conversationId,
        String status,
        Instant requestedAt,
        String channelState,
        boolean withinBusinessHours,
        Instant nextOpenAt,
        String businessHoursText
) {}
