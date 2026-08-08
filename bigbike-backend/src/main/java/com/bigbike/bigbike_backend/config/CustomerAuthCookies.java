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
    public static final String COOKIE_GUEST_ID = "bb_guest_id";

    private static final String REFRESH_PATH = "/api/v1/customer/auth/refresh";
    private static final String OAUTH_PATH = "/api/v1/customer/auth/oauth";
    /** OAuth state lives only for the duration of the provider round-trip. */
    private static final int OAUTH_STATE_TTL_SECONDS = 600;
    /** Guest cart identity — and the CSRF token issued alongside it — live as long as the cart. */
    private static final int GUEST_TTL_SECONDS = 60 * 60 * 24 * 30;

    private final boolean cookiesSecure;
    private final String cookieDomain;

    public CustomerAuthCookies(
            @Value("${bigbike.cookies.secure:true}") boolean cookiesSecure,
            @Value("${bigbike.cookies.domain:}") String cookieDomain) {
        this.cookiesSecure = cookiesSecure;
        this.cookieDomain = cookieDomain == null || cookieDomain.isBlank() ? null : cookieDomain.trim();
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

    /** Guest cart identity. Readable by JS so the storefront can clear it on logout. */
    public void setGuestId(HttpServletResponse response, String guestId) {
        addCookie(response, COOKIE_GUEST_ID, guestId, "/", GUEST_TTL_SECONDS, false, "Strict");
    }

    public void clearGuestId(HttpServletResponse response) {
        addCookie(response, COOKIE_GUEST_ID, "", "/", 0, false, "Strict");
    }

    /** CSRF token for guests (no session yet) — same attributes as the logged-in one. */
    public void setGuestCsrf(HttpServletResponse response, String csrfToken) {
        addCookie(response, COOKIE_CSRF, csrfToken, "/", GUEST_TTL_SECONDS, false, "Strict");
    }

    public void addCookie(HttpServletResponse response, String name, String value, String path,
            int maxAge, boolean httpOnly, String sameSite) {
        // Without an explicit Domain the cookie is host-only: one issued by api.bigbike.vn is
        // invisible to the storefront on bigbike.vn, so the browser can never echo `bb_csrf`
        // back as the X-CSRF-Token header and every customer mutation fails with 403.
        // Setting the registrable domain shares the cookie across the eTLD+1. Blank = host-only
        // (correct for localhost dev, where web and API differ only by port).
        if (cookieDomain != null) {
            expireLegacyHostOnlyCookie(response, name, path);
        }
        ResponseCookie.ResponseCookieBuilder cookie = ResponseCookie.from(name, value)
                .httpOnly(httpOnly)
                .secure(cookiesSecure)
                .path(path)
                .maxAge(maxAge)
                .sameSite(sameSite);
        if (cookieDomain != null) {
            cookie.domain(cookieDomain);
        }
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.build().toString());
    }

    /**
     * Kills the host-only cookie of the same name left over from before a Domain was configured.
     * A host-only and a domain-scoped cookie with the same name are two distinct entries, and the
     * browser sends BOTH to the API host — whichever the server reads first may be the stale one,
     * which is exactly the 403 the Domain change is meant to fix. Emitted before the real
     * Set-Cookie so the fresh value always wins. No-op once every visitor has been re-cookied.
     */
    private void expireLegacyHostOnlyCookie(HttpServletResponse response, String name, String path) {
        ResponseCookie legacy = ResponseCookie.from(name, "")
                .httpOnly(false)
                .secure(cookiesSecure)
                .path(path)
                .maxAge(0)
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, legacy.toString());
    }
}
