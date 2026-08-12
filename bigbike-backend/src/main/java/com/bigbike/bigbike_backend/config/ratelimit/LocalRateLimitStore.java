package com.bigbike.bigbike_backend.config.ratelimit;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.time.Instant;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;

/**
 * Bounded emergency/dev limiter. It is deliberately not used as a distributed production
 * source of truth: its state disappears on restart and is per replica.
 */
@Component
public class LocalRateLimitStore implements RateLimitStore {

    private static final int CLEANUP_INTERVAL = 256;

    private final RateLimitProperties properties;
    private final LinkedHashMap<String, Entry> buckets = new LinkedHashMap<>(256, 0.75f, true);
    private long operations;

    public LocalRateLimitStore(RateLimitProperties properties, MeterRegistry meterRegistry) {
        this.properties = properties;
        Gauge.builder("bigbike.rate_limit.local.entries", this, LocalRateLimitStore::size)
                .description("Active bounded local rate-limit entries")
                .register(meterRegistry);
    }

    @Override
    public synchronized RateLimitDecision consume(RateLimitKey key, RateLimitPolicy policy) {
        Instant now = Instant.now();
        if (++operations % CLEANUP_INTERVAL == 0) {
            removeExpired(now);
        }

        Entry entry = buckets.get(key.storageKey());
        if (entry == null || !entry.policy().equals(policy) || entry.expiresAt().isBefore(now)) {
            entry = new Entry(newBucket(policy), policy, expiresAt(now, policy));
            putBounded(key.storageKey(), entry);
        }

        ConsumptionProbe probe = entry.bucket().tryConsumeAndReturnRemaining(1);
        if (probe.isConsumed()) {
            return RateLimitDecision.allowed(probe.getRemainingTokens(), mode());
        }
        return RateLimitDecision.rejected(toRetryAfterSeconds(probe.getNanosToWaitForRefill()), mode());
    }

    @Override
    public String mode() {
        return "local";
    }

    /** Package-visible for bounded-memory tests and Micrometer gauges. */
    synchronized int size() {
        return buckets.size();
    }

    private void putBounded(String key, Entry entry) {
        int maxEntries = properties.getFallbackMaxEntries();
        if (maxEntries < 1) {
            throw new IllegalStateException("bigbike.rate-limit.fallback-max-entries must be at least 1");
        }
        while (buckets.size() >= maxEntries) {
            Iterator<Map.Entry<String, Entry>> iterator = buckets.entrySet().iterator();
            if (!iterator.hasNext()) {
                break;
            }
            iterator.next();
            iterator.remove();
        }
        buckets.put(key, entry);
    }

    private void removeExpired(Instant now) {
        Iterator<Map.Entry<String, Entry>> iterator = buckets.entrySet().iterator();
        while (iterator.hasNext()) {
            if (iterator.next().getValue().expiresAt().isBefore(now)) {
                iterator.remove();
            }
        }
    }

    private Instant expiresAt(Instant now, RateLimitPolicy policy) {
        int multiplier = properties.getLocalEntryTtlMultiplier();
        if (multiplier < 1) {
            throw new IllegalStateException("bigbike.rate-limit.local-entry-ttl-multiplier must be at least 1");
        }
        try {
            return now.plus(policy.window().multipliedBy(multiplier));
        } catch (ArithmeticException ex) {
            throw new IllegalStateException("Rate-limit local entry TTL is too large", ex);
        }
    }

    private static Bucket newBucket(RateLimitPolicy policy) {
        return Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(policy.limit())
                        .refillGreedy(policy.limit(), policy.window())
                        .build())
                .build();
    }

    private static long toRetryAfterSeconds(long nanos) {
        long seconds = TimeUnit.NANOSECONDS.toSeconds(nanos);
        return nanos % TimeUnit.SECONDS.toNanos(1) == 0 ? Math.max(1, seconds) : seconds + 1;
    }

    private record Entry(Bucket bucket, RateLimitPolicy policy, Instant expiresAt) {
    }
}
