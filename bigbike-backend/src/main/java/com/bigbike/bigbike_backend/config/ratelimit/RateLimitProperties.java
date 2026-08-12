package com.bigbike.bigbike_backend.config.ratelimit;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.convert.DurationStyle;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.EnvironmentAware;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Deployment configuration for rate limiting. Individual tier values are optional overrides;
 * defaults live in {@link RateLimitTier} so there is one canonical definition per tier.
 */
@Component
@ConfigurationProperties(prefix = "bigbike.rate-limit")
@Getter
@Setter
public class RateLimitProperties implements EnvironmentAware {

    public enum Store {
        LOCAL,
        REDIS
    }

    private boolean enabled = true;
    private Store store = Store.LOCAL;
    private String redisUrl = "";
    private long redisTimeoutMillis = 100;
    private String hmacSecret = "";
    private int fallbackMaxEntries = 50_000;
    private int localEntryTtlMultiplier = 2;
    private Map<String, TierOverride> tiers = new HashMap<>();
    private Environment environment;

    public RateLimitPolicy policyFor(RateLimitTier tier) {
        TierOverride override = tiers.get(tier.key());
        Long environmentLimit = environmentLimit(tier);
        Duration environmentWindow = environmentWindow(tier);
        long limit = environmentLimit != null
                ? environmentLimit
                : override != null && override.getLimit() != null ? override.getLimit() : tier.defaultLimit();
        Duration window = environmentWindow != null
                ? environmentWindow
                : override != null && override.getWindow() != null ? override.getWindow() : tier.defaultWindow();
        if (limit < 1 || window.isNegative() || window.isZero()) {
            throw new IllegalStateException("Invalid rate-limit policy for tier " + tier.key());
        }
        return new RateLimitPolicy(tier, limit, window, tier.failClosedWhenStoreUnavailable());
    }

    /**
     * Compose has an explicit environment allowlist, and environment-variable relaxed binding
     * cannot faithfully represent a map key such as {@code password-reset}. Resolve the
     * documented per-tier variables directly so an approved deployment override is never lost.
     */
    @Override
    public void setEnvironment(Environment environment) {
        this.environment = environment;
    }

    private Long environmentLimit(RateLimitTier tier) {
        String value = environmentValue(tier, "LIMIT");
        if (value == null) {
            return null;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ex) {
            throw new IllegalStateException("Invalid rate-limit limit override for tier " + tier.key(), ex);
        }
    }

    private Duration environmentWindow(RateLimitTier tier) {
        String value = environmentValue(tier, "WINDOW");
        if (value == null) {
            return null;
        }
        try {
            return DurationStyle.detectAndParse(value);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("Invalid rate-limit window override for tier " + tier.key(), ex);
        }
    }

    private String environmentValue(RateLimitTier tier, String suffix) {
        if (environment == null) {
            return null;
        }
        String value = environment.getProperty("BIGBIKE_RATE_LIMIT_TIERS_" + tier.name() + '_' + suffix);
        return value == null || value.isBlank() ? null : value.trim();
    }

    @Getter
    @Setter
    public static class TierOverride {
        private Long limit;
        private Duration window;
    }
}
