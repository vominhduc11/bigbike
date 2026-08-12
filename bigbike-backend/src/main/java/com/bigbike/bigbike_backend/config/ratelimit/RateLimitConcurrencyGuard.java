package com.bigbike.bigbike_backend.config.ratelimit;

import com.bigbike.bigbike_backend.api.error.RateLimitExceededException;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * In-flight guard for expensive upload/import/export work. Redis mode uses atomic, expiring
 * sorted-set leases shared by replicas; local mode exists only for development/test.
 */
@Component
@Slf4j
public class RateLimitConcurrencyGuard {

    private static final int MAX_ADMIN_MEDIA_PER_ACCOUNT = 2;
    private static final int MAX_ADMIN_MEDIA_GLOBAL = 10;
    private static final int MAX_ADMIN_IMPORT_GLOBAL = 1;
    private static final int MAX_ADMIN_EXPORT_GLOBAL = 3;
    private static final Duration MEDIA_LEASE_TTL = Duration.ofMinutes(10);
    private static final Duration IMPORT_LEASE_TTL = Duration.ofMinutes(30);
    private static final Duration EXPORT_LEASE_TTL = Duration.ofMinutes(15);

    private final MeterRegistry meterRegistry;
    private final RateLimitProperties properties;
    private final RateLimitKeyFactory keyFactory;
    private final ObjectProvider<RedisRateLimitStore> redisStoreProvider;
    private final Object lock = new Object();
    private final Map<UUID, Integer> activeMediaByAccount = new HashMap<>();
    private int activeMedia;
    private int activeImports;
    private int activeExports;

    public RateLimitConcurrencyGuard(
            MeterRegistry meterRegistry,
            RateLimitProperties properties,
            RateLimitKeyFactory keyFactory,
            ObjectProvider<RedisRateLimitStore> redisStoreProvider
    ) {
        this.meterRegistry = meterRegistry;
        this.properties = properties;
        this.keyFactory = keyFactory;
        this.redisStoreProvider = redisStoreProvider;
    }

    public Lease acquireAdminMedia(UUID accountId) {
        if (!properties.isEnabled()) {
            return Lease.noop();
        }
        if (properties.getStore() == RateLimitProperties.Store.REDIS) {
            return acquireRedis(
                    "admin-media", RateLimitTier.ADMIN_MEDIA, accountId,
                    MAX_ADMIN_MEDIA_GLOBAL, MAX_ADMIN_MEDIA_PER_ACCOUNT, MEDIA_LEASE_TTL);
        }
        return acquireLocalMedia(accountId);
    }

    public Lease acquireAdminImport() {
        if (!properties.isEnabled()) {
            return Lease.noop();
        }
        if (properties.getStore() == RateLimitProperties.Store.REDIS) {
            return acquireRedis(
                    "admin-import", RateLimitTier.ADMIN_IMPORT_COMMIT, null,
                    MAX_ADMIN_IMPORT_GLOBAL, MAX_ADMIN_IMPORT_GLOBAL, IMPORT_LEASE_TTL);
        }
        synchronized (lock) {
            if (activeImports >= MAX_ADMIN_IMPORT_GLOBAL) {
                rejected("admin-import");
                throw new RateLimitExceededException(1);
            }
            activeImports++;
            return new Lease(() -> releaseLocal("admin-import"));
        }
    }

    public Lease acquireAdminExport() {
        if (!properties.isEnabled()) {
            return Lease.noop();
        }
        if (properties.getStore() == RateLimitProperties.Store.REDIS) {
            return acquireRedis(
                    "admin-export", RateLimitTier.ADMIN_EXPORT, null,
                    MAX_ADMIN_EXPORT_GLOBAL, MAX_ADMIN_EXPORT_GLOBAL, EXPORT_LEASE_TTL);
        }
        synchronized (lock) {
            if (activeExports >= MAX_ADMIN_EXPORT_GLOBAL) {
                rejected("admin-export");
                throw new RateLimitExceededException(1);
            }
            activeExports++;
            return new Lease(() -> releaseLocal("admin-export"));
        }
    }

    private Lease acquireRedis(
            String operation,
            RateLimitTier tier,
            UUID accountId,
            int globalLimit,
            int accountLimit,
            Duration ttl
    ) {
        String globalKey = keyFactory.create(tier, RateLimitScope.GLOBAL, "global").storageKey() + ":concurrency";
        String accountKey = accountId == null
                ? globalKey
                : keyFactory.create(tier, RateLimitScope.ADMIN_ACCOUNT, accountId.toString()).storageKey()
                        + ":concurrency";
        String leaseId = UUID.randomUUID().toString();
        try {
            RedisRateLimitStore redisStore = redisStoreProvider.getIfAvailable();
            if (redisStore == null) {
                throw new IllegalStateException("Redis concurrency store is unavailable");
            }
            if (!redisStore.tryAcquireConcurrency(
                    globalKey, accountKey, globalLimit, accountLimit, leaseId, ttl)) {
                rejected(operation);
                throw new RateLimitExceededException(1);
            }
            return new Lease(() -> releaseRedis(operation, redisStore, globalKey, accountKey, leaseId));
        } catch (RateLimitExceededException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            Counter.builder("bigbike.rate_limit.concurrency.store.errors")
                    .tag("operation", operation)
                    .register(meterRegistry)
                    .increment();
            log.warn("Distributed rate-limit concurrency store unavailable for operation={}", operation);
            // All current guarded operations are admin-side and deliberately fail closed.
            throw new RateLimitExceededException(60);
        }
    }

    private Lease acquireLocalMedia(UUID accountId) {
        synchronized (lock) {
            int accountActive = activeMediaByAccount.getOrDefault(accountId, 0);
            if (activeMedia >= MAX_ADMIN_MEDIA_GLOBAL || accountActive >= MAX_ADMIN_MEDIA_PER_ACCOUNT) {
                rejected("admin-media");
                throw new RateLimitExceededException(1);
            }
            activeMedia++;
            activeMediaByAccount.put(accountId, accountActive + 1);
            return new Lease(() -> releaseLocalMedia(accountId));
        }
    }

    private void releaseRedis(
            String operation,
            RedisRateLimitStore redisStore,
            String globalKey,
            String accountKey,
            String leaseId
    ) {
        try {
            redisStore.releaseConcurrency(globalKey, accountKey, leaseId);
        } catch (RuntimeException ex) {
            // The request's work already completed. Let the lease TTL recover capacity rather
            // than converting that successful response into a 500 during close().
            Counter.builder("bigbike.rate_limit.concurrency.store.errors")
                    .tag("operation", operation)
                    .register(meterRegistry)
                    .increment();
            log.warn("Distributed rate-limit concurrency lease release failed for operation={}", operation);
        }
    }

    private void releaseLocalMedia(UUID accountId) {
        synchronized (lock) {
            activeMedia--;
            int remaining = activeMediaByAccount.getOrDefault(accountId, 1) - 1;
            if (remaining <= 0) {
                activeMediaByAccount.remove(accountId);
            } else {
                activeMediaByAccount.put(accountId, remaining);
            }
        }
    }

    private void releaseLocal(String operation) {
        synchronized (lock) {
            switch (operation) {
                case "admin-import" -> activeImports--;
                case "admin-export" -> activeExports--;
                default -> throw new IllegalArgumentException("Unknown guarded operation");
            }
        }
    }

    private void rejected(String operation) {
        Counter.builder("bigbike.rate_limit.concurrency.rejections")
                .tag("operation", operation)
                .register(meterRegistry)
                .increment();
    }

    public static final class Lease implements AutoCloseable {
        private final Runnable releaser;
        private boolean released;

        private Lease(Runnable releaser) {
            this.releaser = releaser;
        }

        private static Lease noop() {
            return new Lease(() -> { });
        }

        @Override
        public synchronized void close() {
            if (!released) {
                released = true;
                releaser.run();
            }
        }
    }
}
