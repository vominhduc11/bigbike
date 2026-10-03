package com.bigbike.bigbike_backend.config.ratelimit;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.error.RateLimitExceededException;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mock.env.MockEnvironment;

class RateLimitConcurrencyGuardTest {

    @Test
    void localMediaLeaseCapsOneAdminAtTwoAndReleasesCapacity() {
        RateLimitConcurrencyGuard guard = localGuard();
        UUID accountId = UUID.randomUUID();
        RateLimitConcurrencyGuard.Lease first = guard.acquireAdminMedia(accountId);
        RateLimitConcurrencyGuard.Lease second = guard.acquireAdminMedia(accountId);

        assertThatThrownBy(() -> guard.acquireAdminMedia(accountId))
                .isInstanceOf(RateLimitExceededException.class);

        first.close();
        RateLimitConcurrencyGuard.Lease replacement = guard.acquireAdminMedia(accountId);
        replacement.close();
        second.close();
    }

    @Test
    void localImportLeaseIsGloballyExclusiveUntilReleased() {
        RateLimitConcurrencyGuard guard = localGuard();
        RateLimitConcurrencyGuard.Lease first = guard.acquireAdminImport();

        assertThatThrownBy(guard::acquireAdminImport)
                .isInstanceOf(RateLimitExceededException.class);

        first.close();
        guard.acquireAdminImport().close();
    }

    @Test
    void redisImportLeaseKeepsItsExistingKeyDuringRollout() {
        RateLimitProperties properties = new RateLimitProperties();
        properties.setStore(RateLimitProperties.Store.REDIS);
        properties.setHmacSecret("test-rate-limit-hmac-secret-with-32-characters");
        RateLimitKeyFactory keyFactory = new RateLimitKeyFactory(properties, new MockEnvironment());
        RedisRateLimitStore redisStore = mock(RedisRateLimitStore.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<RedisRateLimitStore> redisStoreProvider = mock(ObjectProvider.class);
        when(redisStoreProvider.getIfAvailable()).thenReturn(redisStore);
        when(redisStore.tryAcquireConcurrency(
                anyString(), anyString(), eq(1), eq(1), anyString(), eq(Duration.ofMinutes(30))))
                .thenReturn(true);
        RateLimitConcurrencyGuard guard = new RateLimitConcurrencyGuard(
                new SimpleMeterRegistry(), properties, keyFactory, redisStoreProvider);

        guard.acquireAdminImport().close();

        // The former hourly commit tier supplied the shared lease key; in-flight imports keep it.
        String existingKey = keyFactory.createStorageKey(
                "admin-import-commit", RateLimitScope.GLOBAL, "global") + ":concurrency";
        verify(redisStore).tryAcquireConcurrency(
                eq(existingKey), eq(existingKey), eq(1), eq(1), anyString(), eq(Duration.ofMinutes(30)));
    }

    @Test
    void disabledRateLimitingAlsoDisablesConcurrencyGuards() {
        RateLimitProperties properties = new RateLimitProperties();
        properties.setEnabled(false);
        properties.setHmacSecret("test-rate-limit-hmac-secret-with-32-characters");
        @SuppressWarnings("unchecked")
        ObjectProvider<RedisRateLimitStore> redisStoreProvider = mock(ObjectProvider.class);
        RateLimitConcurrencyGuard guard = new RateLimitConcurrencyGuard(
                new SimpleMeterRegistry(),
                properties,
                new RateLimitKeyFactory(properties, new MockEnvironment()),
                redisStoreProvider);

        for (int i = 0; i < 12; i++) {
            guard.acquireAdminMedia(UUID.randomUUID()).close();
        }
        guard.acquireAdminImport().close();
        guard.acquireAdminImport().close();
        guard.acquireAdminExport().close();
        guard.acquireAdminExport().close();
    }

    private static RateLimitConcurrencyGuard localGuard() {
        RateLimitProperties properties = new RateLimitProperties();
        properties.setHmacSecret("test-rate-limit-hmac-secret-with-32-characters");
        @SuppressWarnings("unchecked")
        ObjectProvider<RedisRateLimitStore> redisStoreProvider = mock(ObjectProvider.class);
        return new RateLimitConcurrencyGuard(
                new SimpleMeterRegistry(),
                properties,
                new RateLimitKeyFactory(properties, new MockEnvironment()),
                redisStoreProvider);
    }
}
