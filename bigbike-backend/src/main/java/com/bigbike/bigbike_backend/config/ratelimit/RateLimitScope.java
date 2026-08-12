package com.bigbike.bigbike_backend.config.ratelimit;

/** Key dimensions deliberately kept low-cardinality and HMAC-protected. */
public enum RateLimitScope {
    IP("ip"),
    IDENTITY("identity"),
    CUSTOMER_SESSION("customer-session"),
    ADMIN_ACCOUNT("admin-account"),
    CONVERSATION("conversation"),
    INTERNAL_TOKEN("internal-token"),
    GLOBAL("global"),
    WEBSOCKET_SESSION("websocket-session");

    private final String key;

    RateLimitScope(String key) {
        this.key = key;
    }

    public String key() {
        return key;
    }
}
