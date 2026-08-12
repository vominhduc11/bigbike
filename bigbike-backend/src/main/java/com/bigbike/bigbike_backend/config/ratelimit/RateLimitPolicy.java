package com.bigbike.bigbike_backend.config.ratelimit;

import java.time.Duration;

/** Resolved tier policy used by both local and Redis Bucket4j stores. */
public record RateLimitPolicy(
        RateLimitTier tier,
        long limit,
        Duration window,
        boolean failClosedWhenStoreUnavailable
) {
}
