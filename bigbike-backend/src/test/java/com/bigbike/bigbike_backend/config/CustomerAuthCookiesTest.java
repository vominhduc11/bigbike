package com.bigbike.bigbike_backend.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * Guards the cross-host cookie contract. The storefront (bigbike.vn) reads {@code bb_csrf}
 * from {@code document.cookie} to build the {@code X-CSRF-Token} header, but the cookie is
 * issued by the API on a different host (api.bigbike.vn). Without an explicit Domain the
 * cookie is host-only and unreadable from the storefront, so every customer mutation —
 * add-to-cart, checkout, profile edit, review — fails with 403 CSRF_INVALID.
 */
class CustomerAuthCookiesTest {

    private static final String DOMAIN = ".bigbike.vn";

    private static CustomerAuthCookies withDomain(String domain) {
        return new CustomerAuthCookies(true, domain);
    }

    private static List<String> setCookieHeaders(MockHttpServletResponse response) {
        return response.getHeaders(HttpHeaders.SET_COOKIE);
    }

    /** The real (domain-scoped) Set-Cookie for a name, ignoring the legacy host-only expiry. */
    private static String headerFor(MockHttpServletResponse response, String cookieName) {
        return setCookieHeaders(response).stream()
                .filter(h -> h.startsWith(cookieName + "=") && h.contains("Domain="))
                .findFirst()
                .orElseThrow(() -> new AssertionError("No domain-scoped Set-Cookie for " + cookieName));
    }

    private static String legacyHeaderFor(MockHttpServletResponse response, String cookieName) {
        return setCookieHeaders(response).stream()
                .filter(h -> h.startsWith(cookieName + "=") && !h.contains("Domain="))
                .findFirst()
                .orElseThrow(() -> new AssertionError("No host-only Set-Cookie for " + cookieName));
    }

    @Test
    void sessionCookiesCarryTheConfiguredDomain() {
        MockHttpServletResponse response = new MockHttpServletResponse();

        withDomain(DOMAIN).applySession(response, "sess", "refr", "csrf", 1800, 2592000);

        assertThat(headerFor(response, CustomerAuthCookies.COOKIE_SESSION)).contains("Domain=" + DOMAIN);
        assertThat(headerFor(response, CustomerAuthCookies.COOKIE_REFRESH)).contains("Domain=" + DOMAIN);
        assertThat(headerFor(response, CustomerAuthCookies.COOKIE_CSRF)).contains("Domain=" + DOMAIN);
    }

    @Test
    void eachDomainCookieIsPrecededByAnExpiryForItsHostOnlyPredecessor() {
        MockHttpServletResponse response = new MockHttpServletResponse();

        withDomain(DOMAIN).applySession(response, "sess", "refr", "csrf", 1800, 2592000);

        // 3 cookies × (legacy expiry + real value)
        assertThat(setCookieHeaders(response)).hasSize(6);
        for (String name : List.of(CustomerAuthCookies.COOKIE_SESSION,
                CustomerAuthCookies.COOKIE_REFRESH, CustomerAuthCookies.COOKIE_CSRF)) {
            String legacy = legacyHeaderFor(response, name);
            assertThat(legacy).contains("Max-Age=0");
            // The expiry must come first so the fresh domain-scoped value wins.
            assertThat(setCookieHeaders(response).indexOf(legacy))
                    .isLessThan(setCookieHeaders(response).indexOf(headerFor(response, name)));
        }
    }

    @Test
    void legacyExpiryRepeatsThePathSoItMatchesTheCookieItReplaces() {
        MockHttpServletResponse response = new MockHttpServletResponse();

        withDomain(DOMAIN).applySession(response, "sess", "refr", "csrf", 1800, 2592000);

        assertThat(legacyHeaderFor(response, CustomerAuthCookies.COOKIE_REFRESH))
                .contains("Path=/api/v1/customer/auth/refresh");
        assertThat(legacyHeaderFor(response, CustomerAuthCookies.COOKIE_SESSION)).contains("Path=/");
    }

    @Test
    void noLegacyExpiryIsEmittedWhenNoDomainIsConfigured() {
        MockHttpServletResponse response = new MockHttpServletResponse();

        withDomain("").applySession(response, "sess", "refr", "csrf", 1800, 2592000);

        assertThat(setCookieHeaders(response)).hasSize(3);
    }

    @Test
    void guestCartCookiesCarryTheConfiguredDomain() {
        MockHttpServletResponse response = new MockHttpServletResponse();
        CustomerAuthCookies cookies = withDomain(DOMAIN);

        cookies.setGuestId(response, "guest-1");
        cookies.setGuestCsrf(response, "csrf-1");

        assertThat(headerFor(response, CustomerAuthCookies.COOKIE_GUEST_ID)).contains("Domain=" + DOMAIN);
        assertThat(headerFor(response, CustomerAuthCookies.COOKIE_CSRF)).contains("Domain=" + DOMAIN);
    }

    @Test
    void clearingACookieRepeatsTheDomainSoTheBrowserActuallyExpiresIt() {
        MockHttpServletResponse response = new MockHttpServletResponse();
        CustomerAuthCookies cookies = withDomain(DOMAIN);

        cookies.clearSession(response);
        cookies.clearGuestId(response);
        cookies.clearOAuthState(response);

        // Every header expires something — the domain-scoped cookie and its host-only predecessor.
        assertThat(setCookieHeaders(response)).allSatisfy(header -> assertThat(header).contains("Max-Age=0"));
        assertThat(headerFor(response, CustomerAuthCookies.COOKIE_SESSION)).contains("Domain=" + DOMAIN);
        assertThat(headerFor(response, CustomerAuthCookies.COOKIE_GUEST_ID)).contains("Domain=" + DOMAIN);
        assertThat(headerFor(response, CustomerAuthCookies.COOKIE_OAUTH_STATE)).contains("Domain=" + DOMAIN);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    void blankDomainStaysHostOnlyForLocalDev(String configured) {
        MockHttpServletResponse response = new MockHttpServletResponse();

        withDomain(configured).applySession(response, "sess", "refr", "csrf", 1800, 2592000);

        assertThat(setCookieHeaders(response)).allSatisfy(header -> assertThat(header).doesNotContain("Domain="));
    }

    @Test
    void nullDomainStaysHostOnly() {
        MockHttpServletResponse response = new MockHttpServletResponse();

        withDomain(null).setOAuthState(response, "nonce|cmV0dXJu");

        assertThat(setCookieHeaders(response)).hasSize(1);
        assertThat(setCookieHeaders(response).get(0)).doesNotContain("Domain=");
    }

    @Test
    void oauthStateStaysLaxSoItSurvivesTheProviderRedirect() {
        MockHttpServletResponse response = new MockHttpServletResponse();

        withDomain(DOMAIN).setOAuthState(response, "nonce|cmV0dXJu");

        String header = headerFor(response, CustomerAuthCookies.COOKIE_OAUTH_STATE);
        assertThat(header).contains("SameSite=Lax");
        assertThat(header).contains("Domain=" + DOMAIN);
        assertThat(header).contains("HttpOnly");
    }

    @Test
    void csrfCookieStaysReadableByScriptsWhileSessionStaysHttpOnly() {
        MockHttpServletResponse response = new MockHttpServletResponse();

        withDomain(DOMAIN).applySession(response, "sess", "refr", "csrf", 1800, 2592000);

        assertThat(headerFor(response, CustomerAuthCookies.COOKIE_CSRF)).doesNotContain("HttpOnly");
        assertThat(headerFor(response, CustomerAuthCookies.COOKIE_SESSION)).contains("HttpOnly");
    }
}
