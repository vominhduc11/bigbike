package com.bigbike.bigbike_backend.service.customer;

import java.util.UUID;

public record CustomerSessionResult(
        UUID sessionId,
        UUID customerId,
        String rawSessionToken,
        String rawRefreshToken,
        String rawCsrfToken
) {}
