package com.bigbike.bigbike_backend.api.auth;

import com.bigbike.bigbike_backend.api.auth.dto.LoginRequest;
import com.bigbike.bigbike_backend.api.auth.dto.LogoutRequest;
import com.bigbike.bigbike_backend.api.auth.dto.RefreshRequest;
import com.bigbike.bigbike_backend.api.auth.dto.TokenResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.domain.auth.AdminUserProfile;
import com.bigbike.bigbike_backend.service.auth.AdminAuthService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.Arrays;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    static final String REFRESH_COOKIE = "bb_admin_refresh";
    private static final int REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

    private final AdminAuthService adminAuthService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AuthController(
            AdminAuthService adminAuthService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.adminAuthService = adminAuthService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @PostMapping("/login")
    public ApiDataResponse<TokenResponse> login(
            @Valid @RequestBody LoginRequest payload,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        TokenResponse tokens = adminAuthService.login(payload.getEmail(), payload.getPassword(), request);
        setRefreshCookie(response, tokens.refreshToken());
        // Return access token in body; refresh token is now in httpOnly cookie only.
        TokenResponse sanitized = new TokenResponse(
                tokens.accessToken(), null, tokens.expiresIn(), tokens.tokenType(), tokens.user());
        return apiResponseFactory.data(sanitized, request);
    }

    @PostMapping("/refresh")
    public ApiDataResponse<TokenResponse> refresh(
            @RequestBody(required = false) RefreshRequest payload,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        // Prefer httpOnly cookie; fall back to body for backward compatibility.
        String rawRefreshToken = readRefreshCookie(request);
        if (rawRefreshToken == null && payload != null) {
            rawRefreshToken = payload.getRefreshToken();
        }
        TokenResponse tokens = adminAuthService.refresh(rawRefreshToken, request);
        setRefreshCookie(response, tokens.refreshToken());
        TokenResponse sanitized = new TokenResponse(
                tokens.accessToken(), null, tokens.expiresIn(), tokens.tokenType(), tokens.user());
        return apiResponseFactory.data(sanitized, request);
    }

    @PostMapping("/logout")
    public ApiDataResponse<Void> logout(
            @RequestBody(required = false) LogoutRequest payload,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        // Prefer cookie; fall back to body token so old clients still work.
        String rawToken = readRefreshCookie(request);
        if (rawToken == null && payload != null) {
            rawToken = payload.getRefreshToken();
        }
        adminAuthService.logout(rawToken);
        clearRefreshCookie(response);
        return apiResponseFactory.data(null, request);
    }

    @GetMapping("/me")
    public ApiDataResponse<AdminUserProfile> me(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            return apiResponseFactory.data(
                    adminAuthService.getProfile(UUID.fromString(principal.id())),
                    request
            );
        }
        // Dev/test fallback — only works in dev/mock profiles
        return apiResponseFactory.data(devAdminAuthService.currentAdminUser(request), request);
    }

    // ── Cookie helpers ────────────────────────────────────────────────────────

    private void setRefreshCookie(HttpServletResponse response, String refreshToken) {
        if (refreshToken == null) return;
        Cookie cookie = new Cookie(REFRESH_COOKIE, refreshToken);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);    // HTTPS only — nginx should enforce this in prod
        cookie.setPath("/api/v1/auth");
        cookie.setMaxAge(REFRESH_COOKIE_MAX_AGE);
        cookie.setAttribute("SameSite", "None"); // cross-origin admin panel
        response.addCookie(cookie);
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie(REFRESH_COOKIE, "");
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/api/v1/auth");
        cookie.setMaxAge(0);
        cookie.setAttribute("SameSite", "None");
        response.addCookie(cookie);
    }

    private String readRefreshCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies())
                .filter(c -> REFRESH_COOKIE.equals(c.getName()))
                .map(Cookie::getValue)
                .filter(v -> !v.isBlank())
                .findFirst()
                .orElse(null);
    }
}
