package com.bigbike.bigbike_backend.api.customer;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.customer.dto.CustomerOAuthLinkResponse;
import com.bigbike.bigbike_backend.api.error.UnauthorizedException;
import com.bigbike.bigbike_backend.config.ClientIpResolver;
import com.bigbike.bigbike_backend.config.CustomerAuthCookies;
import com.bigbike.bigbike_backend.config.CustomerSessionFilter;
import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.service.customer.CustomerAuthService;
import com.bigbike.bigbike_backend.service.customer.CustomerOAuthService;
import com.bigbike.bigbike_backend.service.customer.CustomerSessionResult;
import com.bigbike.bigbike_backend.service.customer.OAuthError;
import com.bigbike.bigbike_backend.service.customer.OAuthRegistrationConsent;
import com.bigbike.bigbike_backend.service.customer.OAuthUserInfo;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

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
    private static final String EN_PREFIX = "/en/";

    private final CustomerOAuthService oauthService;
    private final CustomerAuthService authService;
    private final CustomerAuthCookies cookies;
    private final ClientIpResolver clientIpResolver;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/{provider}/authorize")
    public void authorize(
            @PathVariable String provider,
            @RequestParam(value = "tiep", required = false) String tiep,
            @RequestParam(value = "privacyConsent", required = false) String privacyConsent,
            @RequestParam(value = "privacyPolicyLocale", required = false) String privacyPolicyLocale,
            HttpServletResponse response
    ) throws IOException {
        String returnTo = sanitizeReturnTo(tiep);
        OAuthRegistrationConsent registrationConsent =
                OAuthRegistrationConsent.of("true".equals(privacyConsent), privacyPolicyLocale);
        if (!oauthService.isSupported(provider)) {
            response.sendRedirect(errorUrl(OAuthError.FAILED, returnTo));
            return;
        }
        String nonce = UUID.randomUUID().toString();
        // Cookie carries the provider + CSRF nonce + post-login destination through the round-trip.
        // Binding the provider stops a state issued for /google/authorize from being replayed at
        // /facebook/callback.
        String encodedReturn = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(returnTo.getBytes(StandardCharsets.UTF_8));
        cookies.setOAuthState(response, provider + "|" + nonce + "|" + encodedReturn + "|"
                + registrationConsent.privacyConsent() + "|"
                + (registrationConsent.privacyPolicyLocale() == null ? "" : registrationConsent.privacyPolicyLocale()));

        try {
            response.sendRedirect(oauthService.buildAuthorizeUrl(provider, nonce));
        } catch (CustomerOAuthService.OAuthException ex) {
            log.warn("OAuth authorize failed for provider {}: {}", provider, ex.getMessage());
            response.sendRedirect(errorUrl(ex.getError(), returnTo));
        } catch (RuntimeException ex) {
            log.warn("OAuth authorize failed for provider {}: {}", provider, ex.getMessage());
            response.sendRedirect(errorUrl(OAuthError.FAILED, returnTo));
        }
    }

    @GetMapping("/{provider}/callback")
    public void callback(
            @PathVariable String provider,
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "state", required = false) String state,
            @RequestParam(value = "error", required = false) String providerError,
            HttpServletRequest request,
            HttpServletResponse response
    ) throws IOException {
        // Read the destination before anything can fail, so even the error page keeps the locale
        // the customer started from.
        OAuthState parsedState = OAuthState.parse(
                CustomerSessionFilter.extractCookie(request, CustomerAuthCookies.COOKIE_OAUTH_STATE));
        String returnTo = parsedState == null ? DEFAULT_RETURN_TO : parsedState.returnTo();

        try {
            // The provider reports a declined consent screen as ?error=..., with no code.
            if (providerError != null) {
                throw new CustomerOAuthService.OAuthException(
                        OAuthError.CANCELLED, "Provider returned error: " + providerError);
            }
            if (!oauthService.isSupported(provider) || code == null || state == null || parsedState == null) {
                throw new CustomerOAuthService.OAuthException(
                        OAuthError.CANCELLED, "Missing OAuth callback parameters.");
            }
            if (!constantTimeEquals(provider, parsedState.provider())
                    || !constantTimeEquals(state, parsedState.nonce())) {
                throw new CustomerOAuthService.OAuthException(OAuthError.FAILED, "OAuth state mismatch.");
            }

            OAuthUserInfo info = oauthService.exchangeCode(provider, code);
            CustomerEntity customer = oauthService.linkOrCreate(provider, info, parsedState.registrationConsent());
            CustomerSessionResult tokens = authService.createSessionForCustomer(
                    customer, clientIpResolver.resolve(request), request.getHeader(HEADER_USER_AGENT));

            cookies.applySession(response,
                    tokens.rawSessionToken(), tokens.rawRefreshToken(), tokens.rawCsrfToken(),
                    tokens.sessionTtlSeconds(), tokens.refreshTtlSeconds());
            cookies.clearOAuthState(response);
            response.sendRedirect(oauthService.webSuccessUrl() + returnTo);
        } catch (CustomerOAuthService.OAuthException ex) {
            log.warn("OAuth callback failed for provider {} ({}): {}",
                    provider, ex.getError(), ex.getMessage());
            cookies.clearOAuthState(response);
            response.sendRedirect(errorUrl(ex.getError(), returnTo));
        } catch (RuntimeException ex) {
            log.warn("OAuth callback failed for provider {}: {}", provider, ex.getMessage());
            cookies.clearOAuthState(response);
            response.sendRedirect(errorUrl(OAuthError.FAILED, returnTo));
        }
    }

    /** Social identities linked to the signed-in customer (account settings panel). */
    @GetMapping("/links")
    public ApiDataResponse<List<CustomerOAuthLinkResponse>> listLinks(HttpServletRequest request) {
        CustomerPrincipal principal = requireCustomer();
        return apiResponseFactory.data(oauthService.listLinks(principal.customerId()), request);
    }

    /** Removes one linked identity. Refused when it is the customer's only way to sign in. */
    @DeleteMapping("/links/{provider}")
    public ApiDataResponse<List<CustomerOAuthLinkResponse>> unlink(
            @PathVariable String provider, HttpServletRequest request) {
        CustomerPrincipal principal = requireCustomer();
        oauthService.unlink(principal.customerId(), provider);
        return apiResponseFactory.data(oauthService.listLinks(principal.customerId()), request);
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private CustomerPrincipal requireCustomer() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomerPrincipal principal) {
            return principal;
        }
        throw new UnauthorizedException("Customer authentication required.");
    }

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

    /**
     * Login page for ordinary failure, or registration for an otherwise-new social identity that
     * needs explicit consent. {@code returnTo} carries the locale prefix ({@code /en/account/}
     * vs {@code /tai-khoan/}), so an English customer is not dropped onto Vietnamese auth.
     */
    private String errorUrl(OAuthError error, String returnTo) {
        boolean english = returnTo != null && returnTo.startsWith(EN_PREFIX);
        boolean needsRegistration = error == OAuthError.REGISTRATION_CONSENT_REQUIRED;
        String authPath = english
                ? (needsRegistration ? "/en/register/" : "/en/login/")
                : (needsRegistration ? "/dang-ky/" : "/dang-nhap/");
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(oauthService.webSuccessUrl() + authPath)
                .queryParam("error", error.code());
        if (needsRegistration) {
            builder.queryParam("tiep", returnTo);
        }
        return builder.build().encode().toUriString();
    }

    private static boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * The {@code bb_oauth_state} cookie payload:
     * {@code provider|nonce|base64url(returnTo)|privacyConsent|privacyPolicyLocale}.
     * The original three-part format remains readable as a no-consent login state.
     */
    private record OAuthState(
            String provider,
            String nonce,
            String returnTo,
            OAuthRegistrationConsent registrationConsent) {

        static OAuthState parse(String cookieValue) {
            if (cookieValue == null) return null;
            String[] parts = cookieValue.split("\\|", -1);
            if (parts.length == 3) {
                return new OAuthState(parts[0], parts[1], decodeReturnTo(parts[2]), OAuthRegistrationConsent.none());
            }
            if (parts.length != 5) return null;
            return new OAuthState(
                    parts[0],
                    parts[1],
                    decodeReturnTo(parts[2]),
                    OAuthRegistrationConsent.of("true".equals(parts[3]), parts[4]));
        }
    }
}
