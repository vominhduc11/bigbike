package com.bigbike.bigbike_backend.api.customer;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.customer.dto.CustomerAuthResponse;
import com.bigbike.bigbike_backend.api.customer.dto.CustomerLoginRequest;
import com.bigbike.bigbike_backend.api.customer.dto.CustomerRegisterRequest;
import com.bigbike.bigbike_backend.api.error.UnauthorizedException;
import com.bigbike.bigbike_backend.config.CustomerSessionFilter;
import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import com.bigbike.bigbike_backend.service.customer.CustomerAuthResult;
import com.bigbike.bigbike_backend.service.customer.CustomerAuthService;
import com.bigbike.bigbike_backend.service.customer.CustomerSessionService;
import com.bigbike.bigbike_backend.service.customer.EmailVerificationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/customer/auth")
public class CustomerAuthController {

    private static final String HEADER_USER_AGENT = "User-Agent";
    private static final String COOKIE_REFRESH = "bb_refresh";
    private static final String COOKIE_CSRF = "bb_csrf";

    private final CustomerAuthService authService;
    private final CustomerSessionService sessionService;
    private final ApiResponseFactory apiResponseFactory;
    private final EmailVerificationService emailVerificationService;

    public CustomerAuthController(
            CustomerAuthService authService,
            CustomerSessionService sessionService,
            ApiResponseFactory apiResponseFactory,
            EmailVerificationService emailVerificationService) {
        this.authService = authService;
        this.sessionService = sessionService;
        this.apiResponseFactory = apiResponseFactory;
        this.emailVerificationService = emailVerificationService;
    }

    @GetMapping("/verify-email")
    public ApiDataResponse<Map<String, Object>> verifyEmail(
            @RequestParam("token") String token,
            HttpServletRequest request
    ) {
        UUID customerId = emailVerificationService.verify(token);
        return apiResponseFactory.data(
                Map.of("customerId", customerId, "verified", Boolean.TRUE),
                request
        );
    }

    @PostMapping("/register")
    public ApiDataResponse<CustomerAuthResponse> register(
            @Valid @RequestBody CustomerRegisterRequest req,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        CustomerAuthResult result = authService.register(req, getClientIp(request), request.getHeader(HEADER_USER_AGENT));
        applySessionCookies(response, result);
        return apiResponseFactory.data(result.response(), request);
    }

    @PostMapping("/login")
    public ApiDataResponse<CustomerAuthResponse> login(
            @Valid @RequestBody CustomerLoginRequest req,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        CustomerAuthResult result = authService.login(req, getClientIp(request), request.getHeader(HEADER_USER_AGENT));
        applySessionCookies(response, result);
        return apiResponseFactory.data(result.response(), request);
    }

    @PostMapping("/refresh")
    public ApiDataResponse<CustomerAuthResponse> refresh(
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String rawRefresh = CustomerSessionFilter.extractCookie(request, COOKIE_REFRESH);
        if (rawRefresh == null) throw new UnauthorizedException("Refresh token missing.");
        CustomerAuthResult result = authService.refresh(rawRefresh, getClientIp(request), request.getHeader(HEADER_USER_AGENT));
        applySessionCookies(response, result);
        return apiResponseFactory.data(result.response(), request);
    }

    @PostMapping("/logout")
    public ApiDataResponse<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomerPrincipal) {
            String rawSession = CustomerSessionFilter.extractCookie(request, CustomerSessionFilter.SESSION_COOKIE);
            if (rawSession != null) {
                sessionService.findBySessionToken(rawSession).ifPresent(authService::logout);
            }
        }
        clearCookies(response);
        return apiResponseFactory.data(null, request);
    }

    // ── cookie helpers ────────────────────────────────────────────────────────

    private void applySessionCookies(HttpServletResponse response, CustomerAuthResult result) {
        addCookie(response, CustomerSessionFilter.SESSION_COOKIE,
                result.rawSessionToken(), "/",
                (int) CustomerSessionService.SESSION_TTL_SECONDS, true);
        addCookie(response, COOKIE_REFRESH,
                result.rawRefreshToken(), "/api/v1/customer/auth/refresh",
                (int) CustomerSessionService.REFRESH_TTL_SECONDS, true);
        addCookie(response, COOKIE_CSRF,
                result.response().csrfToken(), "/",
                (int) CustomerSessionService.SESSION_TTL_SECONDS, false);
    }

    private void clearCookies(HttpServletResponse response) {
        addCookie(response, CustomerSessionFilter.SESSION_COOKIE, "", "/", 0, true);
        addCookie(response, COOKIE_REFRESH, "", "/api/v1/customer/auth/refresh", 0, true);
        addCookie(response, COOKIE_CSRF, "", "/", 0, false);
    }

    private void addCookie(HttpServletResponse response, String name, String value,
            String path, int maxAge, boolean httpOnly) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(httpOnly)
                .secure(false)
                .path(path)
                .maxAge(maxAge)
                .sameSite("Strict")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
