package com.bigbike.bigbike_backend.config.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.util.HashMap;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mock.env.MockEnvironment;

class RateLimitServiceTest {

    @Test
    void localBucketIsThreadSafeAndAllowsOnlyConfiguredBurst() throws Exception {
        RateLimitProperties properties = properties();
        RateLimitService service = localService(properties);
        ExecutorService executor = Executors.newFixedThreadPool(16);
        try {
            java.util.List<Callable<Boolean>> calls = java.util.stream.IntStream.range(0, 40)
                    .<Callable<Boolean>>mapToObj(ignored -> () -> service
                            .check(RateLimitTier.LOGIN, RateLimitScope.IP, "203.0.113.10").allowed())
                    .toList();
            java.util.List<Future<Boolean>> results = executor.invokeAll(calls);

            long allowed = results.stream().filter(result -> {
                try {
                    return result.get();
                } catch (Exception ex) {
                    throw new AssertionError(ex);
                }
            }).count();
            assertThat(allowed).isEqualTo(5);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void localStoreEvictsOldestEntriesAtConfiguredBound() {
        RateLimitProperties properties = properties();
        properties.setFallbackMaxEntries(2);
        SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
        LocalRateLimitStore localStore = new LocalRateLimitStore(properties, meterRegistry);
        RateLimitKeyFactory keys = new RateLimitKeyFactory(properties, new MockEnvironment());
        RateLimitPolicy policy = properties.policyFor(RateLimitTier.SEARCH);

        localStore.consume(keys.create(RateLimitTier.SEARCH, RateLimitScope.IP, "203.0.113.1"), policy);
        localStore.consume(keys.create(RateLimitTier.SEARCH, RateLimitScope.IP, "203.0.113.2"), policy);
        localStore.consume(keys.create(RateLimitTier.SEARCH, RateLimitScope.IP, "203.0.113.3"), policy);

        assertThat(localStore.size()).isEqualTo(2);
    }

    @Test
    void greedyRefillRestoresAConsumedTokenAfterWindow() throws Exception {
        RateLimitProperties properties = properties();
        RateLimitProperties.TierOverride override = new RateLimitProperties.TierOverride();
        override.setLimit(1L);
        override.setWindow(Duration.ofMillis(80));
        properties.setTiers(new HashMap<>(java.util.Map.of(RateLimitTier.LOGIN.key(), override)));
        RateLimitService service = localService(properties);

        assertThat(service.check(RateLimitTier.LOGIN, RateLimitScope.IP, "203.0.113.10").allowed()).isTrue();
        assertThat(service.check(RateLimitTier.LOGIN, RateLimitScope.IP, "203.0.113.10").allowed()).isFalse();

        Thread.sleep(110);
        assertThat(service.check(RateLimitTier.LOGIN, RateLimitScope.IP, "203.0.113.10").allowed()).isTrue();
    }

    @Test
    void redisFailureFailsClosedForLoginAndFallsBackForCheckout() {
        RateLimitProperties properties = properties();
        properties.setStore(RateLimitProperties.Store.REDIS);
        SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
        LocalRateLimitStore localStore = new LocalRateLimitStore(properties, meterRegistry);
        @SuppressWarnings("unchecked")
        ObjectProvider<RedisRateLimitStore> absentRedis = mock(ObjectProvider.class);
        RateLimitService service = new RateLimitService(
                properties,
                new RateLimitKeyFactory(properties, new MockEnvironment()),
                localStore,
                absentRedis,
                meterRegistry);

        RateLimitDecision login = service.check(RateLimitTier.LOGIN, RateLimitScope.IP, "203.0.113.10");
        RateLimitDecision checkout = service.check(RateLimitTier.CHECKOUT, RateLimitScope.IP, "203.0.113.10");

        assertThat(login.allowed()).isFalse();
        assertThat(login.retryAfterSeconds()).isEqualTo(60);
        assertThat(login.storeMode()).isEqualTo("fail-closed");
        assertThat(checkout.allowed()).isTrue();
        assertThat(checkout.storeMode()).isEqualTo("local-fallback");
    }

    @Test
    void sameHmacSecretGeneratesStableOpaqueRedisKeyAcrossInstances() {
        RateLimitProperties properties = properties();
        RateLimitKeyFactory first = new RateLimitKeyFactory(properties, new MockEnvironment());
        RateLimitKeyFactory second = new RateLimitKeyFactory(properties, new MockEnvironment());

        String firstKey = first.create(RateLimitTier.LOGIN, RateLimitScope.IDENTITY, "customer@example.com").storageKey();
        String secondKey = second.create(RateLimitTier.LOGIN, RateLimitScope.IDENTITY, "customer@example.com").storageKey();

        assertThat(firstKey).isEqualTo(secondKey);
        assertThat(firstKey).doesNotContain("customer@example.com");
    }

    private static RateLimitService localService(RateLimitProperties properties) {
        SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
        LocalRateLimitStore localStore = new LocalRateLimitStore(properties, meterRegistry);
        @SuppressWarnings("unchecked")
        ObjectProvider<RedisRateLimitStore> redisStoreProvider = mock(ObjectProvider.class);
        return new RateLimitService(
                properties,
                new RateLimitKeyFactory(properties, new MockEnvironment()),
                localStore,
                redisStoreProvider,
                meterRegistry);
    }

    private static RateLimitProperties properties() {
        RateLimitProperties properties = new RateLimitProperties();
        properties.setHmacSecret("test-rate-limit-hmac-secret-with-32-characters");
        return properties;
    }
}
