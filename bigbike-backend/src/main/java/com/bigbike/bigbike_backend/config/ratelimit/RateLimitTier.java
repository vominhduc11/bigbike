package com.bigbike.bigbike_backend.config.ratelimit;

import java.time.Duration;

/**
 * Canonical application rate-limit tiers. Defaults are documented in
 * docs/engineering/RATE_LIMITING.md and can be overridden through
 * bigbike.rate-limit.tiers.&lt;tier&gt;.* configuration.
 */
public enum RateLimitTier {

    LOGIN("login", 5, Duration.ofMinutes(1), true),
    REGISTER("register", 3, Duration.ofMinutes(1), true),
    PASSWORD_RESET("password-reset", 5, Duration.ofMinutes(1), true),
    RESEND_VERIFICATION("resend-verification", 3, Duration.ofHours(1), true),
    REFRESH("refresh", 30, Duration.ofMinutes(1), true),
    CUSTOMER_MUTATION("customer-mutation", 30, Duration.ofMinutes(1), false),
    CUSTOMER_MEDIA("customer-media", 30, Duration.ofMinutes(1), true),
    CHECKOUT("checkout", 5, Duration.ofMinutes(1), false),
    ORDER_LOOKUP("order-lookup", 20, Duration.ofMinutes(1), false),
    SEARCH("search", 60, Duration.ofMinutes(1), false),
    REVIEW("review", 5, Duration.ofMinutes(1), true),
    REVIEW_PHOTO("review-photo", 30, Duration.ofMinutes(1), true),
    CHAT("chat", 10, Duration.ofMinutes(1), true),
    OAUTH("oauth", 20, Duration.ofMinutes(1), true),
    ADMIN_MUTATION("admin-mutation", 60, Duration.ofMinutes(1), true),
    ADMIN_MEDIA("admin-media", 30, Duration.ofMinutes(1), true),
    ADMIN_IMPORT_VALIDATE("admin-import-validate", 6, Duration.ofHours(1), true),
    ADMIN_IMPORT_COMMIT("admin-import-commit", 2, Duration.ofHours(1), true),
    ADMIN_EXPORT("admin-export", 12, Duration.ofHours(1), true),
    INTERNAL("internal", 300, Duration.ofMinutes(1), true),
    WEBSOCKET_HANDSHAKE("websocket-handshake", 10, Duration.ofMinutes(1), true),
    WEBSOCKET_COMMAND("websocket-command", 60, Duration.ofMinutes(1), true);

    private final String key;
    private final long defaultLimit;
    private final Duration defaultWindow;
    private final boolean failClosedWhenStoreUnavailable;

    RateLimitTier(
            String key,
            long defaultLimit,
            Duration defaultWindow,
            boolean failClosedWhenStoreUnavailable
    ) {
        this.key = key;
        this.defaultLimit = defaultLimit;
        this.defaultWindow = defaultWindow;
        this.failClosedWhenStoreUnavailable = failClosedWhenStoreUnavailable;
    }

    public String key() {
        return key;
    }

    public long defaultLimit() {
        return defaultLimit;
    }

    public Duration defaultWindow() {
        return defaultWindow;
    }

    public boolean failClosedWhenStoreUnavailable() {
        return failClosedWhenStoreUnavailable;
    }
}
