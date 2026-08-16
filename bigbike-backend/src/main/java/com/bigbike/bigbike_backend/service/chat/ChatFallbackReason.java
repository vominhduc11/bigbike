package com.bigbike.bigbike_backend.service.chat;

/** Fixed, PII-free operational codes for every blocked or fallback assistant response. */
public enum ChatFallbackReason {
    SERVICE_DISABLED,
    SERVICE_NOT_CONFIGURED,
    DAILY_LIMIT_REACHED,
    FAST_PATH_EXCEPTION,
    FAST_PATH_GUARD_REJECTED,
    AI_NO_SAFE_RESULT,
    AI_GUARD_REJECTED,
    UNSAFE_PRODUCT_FILTERED
}
