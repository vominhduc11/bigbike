package com.bigbike.bigbike_backend.service.customer;

import com.bigbike.bigbike_backend.api.customer.dto.CustomerAuthResponse;

public record CustomerAuthResult(
        CustomerAuthResponse response,
        String rawSessionToken,
        String rawRefreshToken,
        /** Lifetime for the bb_session / bb_csrf cookies, in seconds. */
        long sessionTtlSeconds,
        /** Lifetime for the bb_refresh cookie, in seconds. */
        long refreshTtlSeconds
) {
    /** Builds a result, copying the cookie lifetimes from the session tokens. */
    public static CustomerAuthResult of(CustomerAuthResponse response, CustomerSessionResult tokens) {
        return new CustomerAuthResult(response, tokens.rawSessionToken(), tokens.rawRefreshToken(),
                tokens.sessionTtlSeconds(), tokens.refreshTtlSeconds());
    }
}
