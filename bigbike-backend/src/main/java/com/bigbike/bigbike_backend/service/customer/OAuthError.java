package com.bigbike.bigbike_backend.service.customer;

import java.util.Locale;

/**
 * Why a social login ended on the storefront login page. The code travels as
 * {@code /dang-nhap/?error=<code>} so the storefront can tell the customer what happened —
 * a single opaque {@code error=oauth} left them re-clicking a button that could never work.
 */
public enum OAuthError {

    /** Customer declined on the provider consent screen, or came back without a code. */
    CANCELLED,
    /** Provider has no client id/secret configured on this deployment. */
    UNCONFIGURED,
    /** The account behind the social identity is not ACTIVE (blocked / pending deletion). */
    BLOCKED,
    /** Anything else: state mismatch, token exchange failure, provider outage. */
    FAILED;

    public String code() {
        return "oauth_" + name().toLowerCase(Locale.ROOT);
    }
}
