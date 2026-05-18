package com.bigbike.bigbike_backend.service.customer;

/** Normalized social-profile fields resolved from an OAuth provider. */
public record OAuthUserInfo(
        /** Stable provider-side user id (the OAuth {@code sub}). */
        String subject,
        String email,
        boolean emailVerified,
        String displayName
) {}
