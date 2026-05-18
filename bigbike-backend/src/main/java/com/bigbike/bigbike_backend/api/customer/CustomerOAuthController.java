package com.bigbike.bigbike_backend.api.customer;

import com.bigbike.bigbike_backend.config.ClientIpResolver;
import com.bigbike.bigbike_backend.config.CustomerAuthCookies;
import com.bigbike.bigbike_backend.config.CustomerSessionFilter;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.service.customer.CustomerAuthService;
import com.bigbike.bigbike_backend.service.customer.CustomerOAuthService;
import com.bigbike.bigbike_backend.service.customer.CustomerSessionResult;
import com.bigbike.bigbike_backend.service.customer.OAuthUserInfo;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Social login (OAuth2) endpoints. Both endpoints are GET browser redirects, not JSON APIs.
 * {@code authorize} starts the flow; the provider sends the user back to {@code callback}.
 */
@RestController
@RequestMapping("/api/v1/customer/auth/oauth")
@RequiredArgsConstructor
@Slf4j
public class CustomerOAuthController {

    private static final String HEADER_USER_AGENT = "User-Agent";
    private static final String DEFAULT_RETURN_TO = "/tai-khoan/";

    private final CustomerOAuthService oauthService;
    private final CustomerAuthService authService;
    private final CustomerAuthCookies cookies;
    private final ClientIpResolver clientIpResolver;

    @GetMapping("/{provider}/authorize")
    public void authorize(
            @PathVariable String provider,
            @RequestParam(value = "tiep", required = false) String tiep,
            HttpServletResponse response
    ) throws IOException {
        if (!oauthService.isSupported(provider)) {
            response.sendRedirect(errorUrl());
            return;
        }
        String returnTo = sanitizeReturnTo(tiep);
        String nonce = UUID.randomUUID().toString();
        // Cookie carries the CSRF nonce + the post-login destination through the provider round-trip.
        String encodedReturn = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(returnTo.getBytes(StandardCharsets.UTF_8));
        cookies.setOAuthState(response, nonce + "|" + encodedReturn);

        try {
            response.sendRedirect(oauthService.buildAuthorizeUrl(provider, nonce));
        } catch (RuntimeException ex) {
            log.warn("OAuth authorize failed for provider {}: {}", provider, ex.getMessage());
            response.sendRedirect(errorUrl());
        }
    }

    @GetMapping("/{provider}/callback")
    public void callback(
            @PathVariable String provider,
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "state", required = false) String state,
            HttpServletRequest request,
            HttpServletResponse response
    ) throws IOException {
        String returnTo = DEFAULT_RETURN_TO;
        try {
            String stateCookie = CustomerSessionFilter.extractCookie(request, CustomerAuthCookies.COOKIE_OAUTH_STATE);
            if (!oauthService.isSupported(provider) || code == null || state == null || stateCookie == null) {
                throw new IllegalStateException("Missing OAuth callback parameters.");
            }
            int sep = stateCookie.indexOf('|');
            if (sep < 0) throw new IllegalStateException("Malformed OAuth state.");
            String nonce = stateCookie.substring(0, sep);
            returnTo = decodeReturnTo(stateCookie.substring(sep + 1));
            if (!constantTimeEquals(state, nonce)) {
                throw new IllegalStateException("OAuth state mismatch.");
            }

            OAuthUserInfo info = oauthService.exchangeCode(provider, code);
            CustomerEntity customer = oauthService.linkOrCreate(provider, info);
            CustomerSessionResult tokens = authService.createSessionForCustomer(
                    customer, clientIpResolver.resolve(request), request.getHeader(HEADER_USER_AGENT));

            cookies.applySession(response,
                    tokens.rawSessionToken(), tokens.rawRefreshToken(), tokens.rawCsrfToken(),
                    tokens.sessionTtlSeconds(), tokens.refreshTtlSeconds());
            cookies.clearOAuthState(response);
            response.sendRedirect(oauthService.webSuccessUrl() + returnTo);
        } catch (RuntimeException ex) {
            log.warn("OAuth callback failed for provider {}: {}", provider, ex.getMessage());
            cookies.clearOAuthState(response);
            response.sendRedirect(errorUrl());
        }
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    /** Only same-site relative paths are allowed as a post-login destination (no open redirect). */
    private static String sanitizeReturnTo(String raw) {
        if (raw == null || raw.isBlank()) return DEFAULT_RETURN_TO;
        String trimmed = raw.trim();
        if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
            return DEFAULT_RETURN_TO;
        }
        return trimmed;
    }

    private static String decodeReturnTo(String encoded) {
        try {
            String decoded = new String(Base64.getUrlDecoder().decode(encoded), StandardCharsets.UTF_8);
            return sanitizeReturnTo(decoded);
        } catch (IllegalArgumentException ex) {
            return DEFAULT_RETURN_TO;
        }
    }

    private String errorUrl() {
        return oauthService.webSuccessUrl() + "/dang-nhap/?error=oauth";
    }

    private static boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
}
