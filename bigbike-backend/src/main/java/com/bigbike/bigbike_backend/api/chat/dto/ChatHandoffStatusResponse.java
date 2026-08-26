package com.bigbike.bigbike_backend.api.chat.dto;

import java.time.Instant;
import java.util.UUID;

public record ChatHandoffStatusResponse(
        UUID id,
        String status,
        Instant requestedAt,
        String channelState,
        String assignedDisplayName,
        boolean withinBusinessHours,
        Instant nextOpenAt,
        String businessHoursText
) {}
