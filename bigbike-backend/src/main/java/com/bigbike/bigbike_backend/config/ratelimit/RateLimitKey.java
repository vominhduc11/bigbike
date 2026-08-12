package com.bigbike.bigbike_backend.config.ratelimit;

/** Redis/local storage key. It contains only a keyed digest, never an identifier. */
public record RateLimitKey(RateLimitTier tier, RateLimitScope scope, String storageKey) {
}
