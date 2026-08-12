package com.bigbike.bigbike_backend.config.ratelimit;

/** Atomic token consumption abstraction. */
public interface RateLimitStore {

    RateLimitDecision consume(RateLimitKey key, RateLimitPolicy policy);

    String mode();
}
