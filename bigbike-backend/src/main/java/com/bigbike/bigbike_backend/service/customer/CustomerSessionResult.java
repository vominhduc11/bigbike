package com.bigbike.bigbike_backend.service.customer;

import java.util.UUID;

public record CustomerSessionResult(
        UUID sessionId,
        UUID customerId,
        String rawSessionToken,
        String rawRefreshToken,
        String rawCsrfToken,
        /** Lifetime applied to the bb_session / bb_csrf cookies, in seconds. */
        long sessionTtlSeconds,
        /** Lifetime applied to the bb_refresh cookie, in seconds — varies with "remember". */
        long refreshTtlSeconds
) {}
