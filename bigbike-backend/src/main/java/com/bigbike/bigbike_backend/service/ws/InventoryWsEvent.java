package com.bigbike.bigbike_backend.service.ws;

import java.time.Instant;

public record InventoryWsEvent(
        String type,
        String productId,
        Instant timestamp
) {}
