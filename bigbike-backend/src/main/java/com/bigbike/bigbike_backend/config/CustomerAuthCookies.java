package com.bigbike.bigbike_backend.config;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * Builds the customer auth cookies. Shared by {@code CustomerAuthController}
 * (password login/register/refresh) and {@code CustomerOAuthController} (social login)
 * so cookie attributes stay identical across both flows.
 */
@Component
public class CustomerAuthCookies {

    public static final String COOKIE_SESSION = CustomerSessionFilter.SESSION_COOKIE; // bb_session
    public static final String COOKIE_REFRESH = "bb_refresh";
    public static final String COOKIE_CSRF = "bb_csrf";
    public static final String COOKIE_OAUTH_STATE = "bb_oauth_state";

    private static final String REFRESH_PATH = "/api/v1/customer/auth/refresh";
    private static final String OAUTH_PATH = "/api/v1/customer/auth/oauth";
    /** OAuth state lives only for the duration of the provider round-trip. */
    private static final int OAUTH_STATE_TTL_SECONDS = 600;

    private final boolean cookiesSecure;

    public CustomerAuthCookies(@Value("${bigbike.cookies.secure:true}") boolean cookiesSecure) {
        this.cookiesSecure = cookiesSecure;
    }

    /** Sets the three session cookies with the given lifetimes (seconds). */
    public void applySession(HttpServletResponse response, String sessionToken, String refreshToken,
            String csrfToken, long sessionTtlSeconds, long refreshTtlSeconds) {
        addCookie(response, COOKIE_SESSION, sessionToken, "/", (int) sessionTtlSeconds, true, "Strict");
        addCookie(response, COOKIE_REFRESH, refreshToken, REFRESH_PATH, (int) refreshTtlSeconds, true, "Strict");
        addCookie(response, COOKIE_CSRF, csrfToken, "/", (int) sessionTtlSeconds, false, "Strict");
    }

    /** Expires the three session cookies (logout). */
    public void clearSession(HttpServletResponse response) {
        addCookie(response, COOKIE_SESSION, "", "/", 0, true, "Strict");
        addCookie(response, COOKIE_REFRESH, "", REFRESH_PATH, 0, true, "Strict");
        addCookie(response, COOKIE_CSRF, "", "/", 0, false, "Strict");
    }

    /**
     * Stores the OAuth CSRF state. SameSite=Lax (not Strict) so the cookie survives
     * the top-level redirect back from the identity provider.
     */
    public void setOAuthState(HttpServletResponse response, String state) {
        addCookie(response, COOKIE_OAUTH_STATE, state, OAUTH_PATH, OAUTH_STATE_TTL_SECONDS, true, "Lax");
    }

    public void clearOAuthState(HttpServletResponse response) {
        addCookie(response, COOKIE_OAUTH_STATE, "", OAUTH_PATH, 0, true, "Lax");
    }

    public void addCookie(HttpServletResponse response, String name, String value, String path,
            int maxAge, boolean httpOnly, String sameSite) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(httpOnly)
                .secure(cookiesSecure)
                .path(path)
                .maxAge(maxAge)
                .sameSite(sameSite)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
