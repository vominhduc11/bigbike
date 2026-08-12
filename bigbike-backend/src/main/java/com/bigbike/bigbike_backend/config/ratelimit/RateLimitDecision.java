package com.bigbike.bigbike_backend.config.ratelimit;

/** Result of one token-bucket decision. No raw key material is retained here. */
public record RateLimitDecision(
        boolean allowed,
        long remainingTokens,
        long retryAfterSeconds,
        String storeMode
) {

    public static RateLimitDecision allowed(long remainingTokens, String storeMode) {
        return new RateLimitDecision(true, remainingTokens, 0, storeMode);
    }

    public static RateLimitDecision rejected(long retryAfterSeconds, String storeMode) {
        return new RateLimitDecision(false, 0, Math.max(1, retryAfterSeconds), storeMode);
    }
}
