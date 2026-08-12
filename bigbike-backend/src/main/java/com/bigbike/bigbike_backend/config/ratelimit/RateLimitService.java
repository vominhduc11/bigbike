package com.bigbike.bigbike_backend.config.ratelimit;

import com.bigbike.bigbike_backend.api.error.RateLimitExceededException;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/** Applies tier policy, coordinates Redis fallback behavior and emits safe metrics. */
@Service
@RequiredArgsConstructor
@Slf4j
public class RateLimitService {

    private final RateLimitProperties properties;
    private final RateLimitKeyFactory keyFactory;
    private final LocalRateLimitStore localStore;
    private final ObjectProvider<RedisRateLimitStore> redisStoreProvider;
    private final MeterRegistry meterRegistry;

    public RateLimitDecision check(RateLimitTier tier, RateLimitScope scope, String subject) {
        long startedAt = System.nanoTime();
        if (!properties.isEnabled()) {
            RateLimitDecision decision = RateLimitDecision.allowed(Long.MAX_VALUE, "disabled");
            recordDecision(tier, scope, decision, startedAt);
            return decision;
        }

        RateLimitPolicy policy = properties.policyFor(tier);
        RateLimitKey key = keyFactory.create(tier, scope, subject);
        RateLimitDecision decision;
        try {
            decision = primaryStore().consume(key, policy);
        } catch (RuntimeException ex) {
            recordStoreError(tier, scope);
            if (policy.failClosedWhenStoreUnavailable()) {
                log.warn("Rate-limit shared store unavailable; denied tier={} scope={}", tier.key(), scope.key());
                decision = RateLimitDecision.rejected(60, "fail-closed");
            } else {
                decision = localStore.consume(key, policy);
                decision = new RateLimitDecision(
                        decision.allowed(), decision.remainingTokens(), decision.retryAfterSeconds(), "local-fallback");
                log.warn("Rate-limit shared store unavailable; using bounded local fallback tier={} scope={}",
                        tier.key(), scope.key());
                Counter.builder("bigbike.rate_limit.fallback.activations")
                        .tag("tier", tier.key())
                        .tag("scope", scope.key())
                        .register(meterRegistry)
                        .increment();
            }
        }
        recordDecision(tier, scope, decision, startedAt);
        return decision;
    }

    public void checkOrThrow(RateLimitTier tier, RateLimitScope scope, String subject) {
        RateLimitDecision decision = check(tier, scope, subject);
        if (!decision.allowed()) {
            throw new RateLimitExceededException(decision.retryAfterSeconds());
        }
    }

    private RateLimitStore primaryStore() {
        if (properties.getStore() == RateLimitProperties.Store.REDIS) {
            RedisRateLimitStore redisStore = redisStoreProvider.getIfAvailable();
            if (redisStore == null) {
                throw new IllegalStateException("Redis rate-limit store is unavailable");
            }
            return redisStore;
        }
        return localStore;
    }

    private void recordDecision(
            RateLimitTier tier,
            RateLimitScope scope,
            RateLimitDecision decision,
            long startedAt
    ) {
        Counter.builder("bigbike.rate_limit.requests")
                .tag("tier", tier.key())
                .tag("scope", scope.key())
                .tag("outcome", decision.allowed() ? "allowed" : "rejected")
                .tag("store", decision.storeMode())
                .register(meterRegistry)
                .increment();
        Timer.builder("bigbike.rate_limit.decision")
                .tag("tier", tier.key())
                .tag("scope", scope.key())
                .tag("store", decision.storeMode())
                .register(meterRegistry)
                .record(System.nanoTime() - startedAt, java.util.concurrent.TimeUnit.NANOSECONDS);
    }

    private void recordStoreError(RateLimitTier tier, RateLimitScope scope) {
        Counter.builder("bigbike.rate_limit.store.errors")
                .tag("tier", tier.key())
                .tag("scope", scope.key())
                .register(meterRegistry)
                .increment();
    }
}
