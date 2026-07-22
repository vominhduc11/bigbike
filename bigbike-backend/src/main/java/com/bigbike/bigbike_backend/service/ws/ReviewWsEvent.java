package com.bigbike.bigbike_backend.service.ws;

import java.time.Instant;

public record ReviewWsEvent(
        String type,
        Long reviewId,
        String productId,
        String status,
        Instant timestamp
) {}
