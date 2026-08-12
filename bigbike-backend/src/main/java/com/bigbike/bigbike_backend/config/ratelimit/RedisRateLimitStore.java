package com.bigbike.bigbike_backend.config.ratelimit;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.ConsumptionProbe;
import io.github.bucket4j.distributed.ExpirationAfterWriteStrategy;
import io.github.bucket4j.distributed.BucketProxy;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;
import io.lettuce.core.RedisClient;
import io.lettuce.core.ScriptOutputType;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.codec.ByteArrayCodec;
import io.lettuce.core.codec.RedisCodec;
import io.lettuce.core.codec.StringCodec;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.TimeUnit;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Redis CAS-backed Bucket4j store with per-key expiry. */
@Component
@ConditionalOnProperty(prefix = "bigbike.rate-limit", name = "store", havingValue = "redis")
public class RedisRateLimitStore implements RateLimitStore {

    private static final String ACQUIRE_CONCURRENCY_SCRIPT = """
            local globalKey = KEYS[1]
            local accountKey = KEYS[2]
            local now = tonumber(ARGV[1])
            local ttl = tonumber(ARGV[2])
            local globalLimit = tonumber(ARGV[3])
            local accountLimit = tonumber(ARGV[4])
            local leaseId = ARGV[5]
            local expiresAt = now + ttl

            redis.call('ZREMRANGEBYSCORE', globalKey, '-inf', now)
            if accountKey ~= globalKey then
              redis.call('ZREMRANGEBYSCORE', accountKey, '-inf', now)
            end
            if redis.call('ZCARD', globalKey) >= globalLimit then
              return 0
            end
            if accountKey ~= globalKey and redis.call('ZCARD', accountKey) >= accountLimit then
              return 0
            end
            redis.call('ZADD', globalKey, expiresAt, leaseId)
            redis.call('PEXPIRE', globalKey, ttl)
            if accountKey ~= globalKey then
              redis.call('ZADD', accountKey, expiresAt, leaseId)
              redis.call('PEXPIRE', accountKey, ttl)
            end
            return 1
            """;

    private static final String RELEASE_CONCURRENCY_SCRIPT = """
            redis.call('ZREM', KEYS[1], ARGV[1])
            if KEYS[2] ~= KEYS[1] then
              redis.call('ZREM', KEYS[2], ARGV[1])
            end
            return 1
            """;

    private final RedisClient redisClient;
    private final RedisCodec<String, byte[]> codec;
    private volatile StatefulRedisConnection<String, byte[]> connection;
    private volatile ProxyManager<String> proxyManager;
    private final ConcurrentMap<RateLimitPolicy, BucketConfiguration> configurations = new ConcurrentHashMap<>();

    public RedisRateLimitStore(RateLimitProperties properties) {
        if (properties.getRedisUrl() == null || properties.getRedisUrl().isBlank()) {
            throw new IllegalStateException("BIGBIKE_RATE_LIMIT_REDIS_URL is required when Redis rate limiting is enabled");
        }
        if (properties.getRedisTimeoutMillis() < 1) {
            throw new IllegalStateException("BIGBIKE_RATE_LIMIT_REDIS_TIMEOUT_MS must be at least 1");
        }

        redisClient = RedisClient.create(properties.getRedisUrl().trim());
        redisClient.setDefaultTimeout(Duration.ofMillis(properties.getRedisTimeoutMillis()));
        codec = RedisCodec.of(StringCodec.UTF8, ByteArrayCodec.INSTANCE);
    }

    @Override
    public RateLimitDecision consume(RateLimitKey key, RateLimitPolicy policy) {
        BucketProxy bucket = proxyManager().builder().build(key.storageKey(), configurationFor(policy));
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
        if (probe.isConsumed()) {
            return RateLimitDecision.allowed(probe.getRemainingTokens(), mode());
        }
        return RateLimitDecision.rejected(toRetryAfterSeconds(probe.getNanosToWaitForRefill()), mode());
    }

    @Override
    public String mode() {
        return "redis";
    }

    /**
     * Acquires a distributed in-flight lease atomically. Each member has its own expiry, so a
     * crashed request self-recovers without retaining an identity key forever.
     */
    public boolean tryAcquireConcurrency(
            String globalKey,
            String accountKey,
            int globalLimit,
            int accountLimit,
            String leaseId,
            Duration ttl
    ) {
        long ttlMillis = ttl.toMillis();
        if (globalLimit < 1 || accountLimit < 1 || ttlMillis < 1) {
            throw new IllegalArgumentException("Invalid distributed concurrency policy");
        }
        Long result = connection().sync().eval(
                ACQUIRE_CONCURRENCY_SCRIPT,
                ScriptOutputType.INTEGER,
                new String[] {globalKey, accountKey},
                argument(System.currentTimeMillis()),
                argument(ttlMillis),
                argument(globalLimit),
                argument(accountLimit),
                argument(leaseId));
        return Long.valueOf(1).equals(result);
    }

    /** Releases only this opaque lease id; expired/reused capacity cannot be decremented. */
    public void releaseConcurrency(String globalKey, String accountKey, String leaseId) {
        connection().sync().eval(
                RELEASE_CONCURRENCY_SCRIPT,
                ScriptOutputType.INTEGER,
                new String[] {globalKey, accountKey},
                argument(leaseId));
    }

    @PreDestroy
    void close() {
        StatefulRedisConnection<String, byte[]> currentConnection = connection;
        if (currentConnection != null) {
            currentConnection.close();
        }
        redisClient.shutdown();
    }

    private BucketConfiguration configurationFor(RateLimitPolicy policy) {
        return configurations.computeIfAbsent(policy, ignored -> BucketConfiguration.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(policy.limit())
                        .refillGreedy(policy.limit(), policy.window())
                        .build())
                .build());
    }

    private ProxyManager<String> proxyManager() {
        ProxyManager<String> currentProxyManager = proxyManager;
        if (currentProxyManager != null) {
            return currentProxyManager;
        }
        synchronized (this) {
            if (proxyManager == null) {
                StatefulRedisConnection<String, byte[]> newConnection = redisClient.connect(codec);
                connection = newConnection;
                proxyManager = LettuceBasedProxyManager.<String>builderFor(newConnection)
                        .withExpirationStrategy(ExpirationAfterWriteStrategy
                                .basedOnTimeForRefillingBucketUpToMax(Duration.ofMinutes(1)))
                        .build();
            }
            return proxyManager;
        }
    }

    private StatefulRedisConnection<String, byte[]> connection() {
        StatefulRedisConnection<String, byte[]> currentConnection = connection;
        if (currentConnection != null) {
            return currentConnection;
        }
        proxyManager();
        return connection;
    }

    private static long toRetryAfterSeconds(long nanos) {
        long seconds = TimeUnit.NANOSECONDS.toSeconds(nanos);
        return nanos % TimeUnit.SECONDS.toNanos(1) == 0 ? Math.max(1, seconds) : seconds + 1;
    }

    private static byte[] argument(Object value) {
        return String.valueOf(value).getBytes(StandardCharsets.UTF_8);
    }
}
